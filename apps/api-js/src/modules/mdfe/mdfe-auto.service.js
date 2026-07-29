import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { getCurrentCertificate } from "../../services/certificate-vault.service.js";
import { resolveIbgeCode } from "../../services/cnpj-lookup.service.js";
import { AppError } from "../../utils/app-error.js";
import {
  authorizeMdfe,
  getMdfe,
  validateMdfeDraft,
} from "./mdfe.service.js";
import { mdfeRouteProvider } from "./mdfe-route.provider.js";

const RESERVATION_TTL_MS = 30 * 60 * 1000;
const ACTIVE_RESERVATIONS = ["RESERVED", "LINKED_TO_DRAFT", "LINKED_TO_ACTIVE_MDFE"];
const ACTIVE_MDFE = [
  "READY_TO_AUTHORIZE", "SIGNING", "SIGNED", "AUTHORIZING",
  "AUTHORIZED", "IN_TRANSIT", "CANCELLING", "CLOSING",
];

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractXmlTag(xml, tagName) {
  if (!xml) return null;
  const match = String(xml).match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([^<]+)</${tagName}>`, "i"));
  return match?.[1]?.trim() || null;
}

function normalizeVolumeData(value) {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows.reduce((total, row) => ({
    grossWeight: total.grossWeight + numberValue(row.pesoBruto ?? row.grossWeight),
    netWeight: total.netWeight + numberValue(row.pesoLiquido ?? row.netWeight),
    packageQuantity: total.packageQuantity + numberValue(row.quantidade ?? row.quantity),
  }), { grossWeight: 0, netWeight: 0, packageQuantity: 0 });
}

function eligibilityFailure(note, company, recipient, activeLink, reservation) {
  const checks = [
    [note.companyId !== company.id, "COMPANY_MISMATCH", "A NF-e pertence a outra empresa."],
    [note.modelo !== "55", "MODEL_NOT_55", "Somente NF-e modelo 55 pode compor este fluxo."],
    [note.status !== "AUTORIZADA" || note.cStat !== "100", "NFE_NOT_AUTHORIZED", "A NF-e não está autorizada."],
    [!note.chaveAcesso, "ACCESS_KEY_REQUIRED", "Chave de acesso ausente."],
    [!note.protocolo || !note.authorization?.protocolo, "PROTOCOL_REQUIRED", "Protocolo de autorização ausente."],
    [!note.xmlProtocolo && !note.authorization?.xmlProtocolo, "AUTHORIZED_XML_REQUIRED", "XML autorizado ausente."],
    [["CANCELADA", "INUTILIZADA", "DENEGADA"].includes(note.status), "NFE_BLOCKED_STATUS", "Situação fiscal incompatível."],
    [!recipient, "RECIPIENT_REQUIRED", "Destinatário cadastrado não encontrado."],
    [!recipient?.municipio, "DESTINATION_CITY_REQUIRED", "Município de destino ausente."],
    [String(recipient?.codigoIbge || "").replace(/\D/g, "").length !== 7, "DESTINATION_IBGE_INVALID", "Código IBGE do destino inválido."],
    [String(recipient?.uf || note.destinatarioUf || "").length !== 2, "DESTINATION_STATE_REQUIRED", "UF de destino ausente."],
    [!recipient?.logradouro || !recipient?.bairro, "DESTINATION_ADDRESS_INCOMPLETE", "Endereço do destinatário incompleto."],
    [Boolean(activeLink), "NFE_ALREADY_LINKED", "A NF-e já está vinculada a um MDF-e ativo."],
    [Boolean(reservation), "NFE_RESERVED", "A NF-e possui reserva concorrente válida."],
  ];
  return checks.find(([failed]) => failed)?.slice(1) || null;
}

async function persistEligibility(tx, input) {
  const previous = await tx.mdfeNfeEligibility.findUnique({
    where: { nfeDocumentId: input.nfeDocumentId },
  });
  const eligibility = await tx.mdfeNfeEligibility.upsert({
    where: { nfeDocumentId: input.nfeDocumentId },
    create: input,
    update: {
      ...input,
      version: { increment: 1 },
    },
  });
  if (!previous || previous.status !== eligibility.status
    || previous.reasonCode !== eligibility.reasonCode) {
    await tx.mdfeNfeEligibilityHistory.create({
      data: {
        companyId: input.companyId,
        eligibilityId: eligibility.id,
        previousStatus: previous?.status || null,
        nextStatus: eligibility.status,
        reasonCode: eligibility.reasonCode,
        reasonMessage: eligibility.reasonMessage,
      },
    });
  }
  return eligibility;
}

export async function evaluateNfeEligibility({
  companyId,
  nfeDocumentId,
  client = prisma,
  ignoreReservationIdempotencyKey = null,
  ignoreMdfeId = null,
}) {
  const note = await client.nfeDocument.findFirst({
    where: { id: nfeDocumentId, companyId, deletedAt: null },
    include: { authorization: true, establishment: true },
  });
  if (!note) throw new AppError("NF-e não encontrada.", "NFE_NOT_FOUND", 404);
  const [company, recipient, activeLink, reservation] = await Promise.all([
    client.company.findUnique({ where: { id: companyId } }),
    note.destinatarioId
      ? client.client.findFirst({ where: { id: note.destinatarioId, companyId } })
      : null,
    client.mdfeFiscalDocumentLink.findFirst({
      where: {
        companyId,
        OR: [{ nfeDocumentId }, { accessKey: note.chaveAcesso || "__missing__" }],
        mdfeDraft: { status: { in: ACTIVE_MDFE }, deletedAt: null },
        ...(ignoreMdfeId ? { mdfeDraftId: { not: ignoreMdfeId } } : {}),
      },
      select: { id: true },
    }),
    client.mdfeNfeReservation.findFirst({
      where: {
        companyId,
        nfeDocumentId,
        status: { in: ACTIVE_RESERVATIONS },
        expiresAt: { gt: new Date() },
        ...(ignoreReservationIdempotencyKey
          ? { idempotencyKey: { not: ignoreReservationIdempotencyKey } }
          : {}),
        ...(ignoreMdfeId ? { mdfeDraftId: { not: ignoreMdfeId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);

  const establishment = note.establishment;
  const authorizedXml = note.authorization?.xmlProtocolo || note.xmlProtocolo;
  const loadingCityCode = extractXmlTag(authorizedXml, "cMun")
    || establishment?.cityCode
    || await resolveIbgeCode(establishment?.city || company.city, establishment?.state || company.uf, null);
  const failure = eligibilityFailure(note, company, recipient, activeLink, reservation)
    || (!loadingCityCode
      ? ["LOADING_IBGE_INVALID", "Código IBGE do município de carregamento ausente."]
      : null);
  const status = failure ? "INELIGIBLE" : "ELIGIBLE";
  const input = {
    companyId,
    establishmentId: establishment?.id || null,
    nfeDocumentId,
    status,
    reasonCode: failure?.[0] || null,
    reasonMessage: failure?.[1] || null,
    establishmentKey: establishment?.id || null,
    loadingCityCode,
    loadingCityName: establishment?.city || company.city,
    loadingState: establishment?.state || company.uf,
    destinationCityCode: String(recipient?.codigoIbge || "").replace(/\D/g, "").slice(0, 7) || null,
    destinationCityName: recipient?.municipio || null,
    destinationState: String(recipient?.uf || note.destinatarioUf || "").toUpperCase() || null,
    cargoOwnershipType: "OWN_CARGO",
    issuerType: "TRANSPORTADOR_CARGA_PROPRIA",
    transportMode: "RODOVIARIO",
    evaluatedAt: new Date(),
  };
  return typeof client.$transaction === "function"
    ? client.$transaction((tx) => persistEligibility(tx, input))
    : persistEligibility(client, input);
}

export function scheduleMdfeEligibilityEvaluation(input) {
  const task = setImmediate(() => {
    void evaluateNfeEligibility(input).catch((error) => {
      console.error({
        code: error.code || "MDFE_ELIGIBILITY_FAILED",
        nfeDocumentId: input.nfeDocumentId,
      }, "MDF-e eligibility evaluation failed");
    });
  });
  task.unref?.();
}

export function groupNfesForAutomaticMdfe(notes) {
  const groups = new Map();
  for (const note of notes) {
    const eligibility = note.mdfeEligibility;
    const key = [
      note.companyId,
      eligibility.establishmentId || eligibility.establishmentKey,
      eligibility.loadingCityCode,
      eligibility.loadingState,
      eligibility.destinationState,
      eligibility.cargoOwnershipType,
      eligibility.issuerType,
      eligibility.transportMode,
      eligibility.contractorId || "",
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => group.sort((left, right) => left.id.localeCompare(right.id)));
}

export function calculatePredominantProduct(notes) {
  const products = new Map();
  let total = 0;
  for (const note of notes) {
    for (const item of note.items || []) {
      const value = numberValue(item.valorTotal);
      total += value;
      const key = `${item.description}|${item.ncm || ""}`;
      const current = products.get(key) || {
        description: item.description,
        ncm: item.ncm || null,
        value: 0,
        origins: [],
      };
      current.value += value;
      current.origins.push({ nfeId: note.id, itemNumber: item.itemNumber });
      products.set(key, current);
    }
  }
  const selected = [...products.values()].sort((left, right) => right.value - left.value)[0];
  if (!selected || total <= 0) return null;
  const participation = selected.value / total;
  return {
    ...selected,
    criterion: "HIGHEST_ITEM_TOTAL_VALUE",
    participation,
    confidence: participation >= 0.5 ? "HIGH" : participation >= 0.3 ? "MEDIUM" : "LOW",
    requiresConfirmation: participation < 0.3,
  };
}

export async function listEligibleNfes(companyId, query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const where = { companyId };
  if (query.eligibilityStatus) where.status = query.eligibilityStatus;
  else if (!query.reservationStatus) where.status = { in: ["ELIGIBLE", "RELEASED"] };
  if (query.destinationState) where.destinationState = String(query.destinationState).toUpperCase();
  if (query.destinationCityCode) where.destinationCityCode = String(query.destinationCityCode);
  if (query.establishmentId) where.establishmentId = query.establishmentId;
  where.nfeDocument = {};
  if (query.issueDateFrom || query.issueDateTo) {
    where.nfeDocument.dataEmissao = {};
    if (query.issueDateFrom) where.nfeDocument.dataEmissao.gte = new Date(query.issueDateFrom);
    if (query.issueDateTo) where.nfeDocument.dataEmissao.lte = new Date(query.issueDateTo);
  }
  if (query.customerId) where.nfeDocument.destinatarioId = query.customerId;
  if (query.reservationStatus) {
    where.nfeDocument.mdfeReservation = { status: query.reservationStatus };
  }
  if (query.search) {
    where.OR = [
      { nfeDocument: { chaveAcesso: { contains: query.search } } },
      { nfeDocument: { destinatarioNome: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.mdfeNfeEligibility.findMany({
      where,
      include: {
        nfeDocument: {
          include: { totals: true, transport: true, authorization: true },
        },
      },
      orderBy: [{ destinationState: "asc" }, { evaluatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mdfeNfeEligibility.count({ where }),
  ]);
  const reservationRows = await prisma.mdfeNfeReservation.findMany({
    where: { nfeDocumentId: { in: rows.map((row) => row.nfeDocumentId) } },
  });
  const reservationByNfe = new Map(reservationRows.map((item) => [item.nfeDocumentId, item]));
  const data = rows.map((row) => {
    const note = row.nfeDocument;
    const volume = normalizeVolumeData(note.transport?.volumes);
    return {
      id: note.id,
      accessKey: note.chaveAcesso,
      number: note.numero,
      series: note.serie,
      authorizedAt: note.authorization?.dataAutorizacao,
      customerName: note.destinatarioNome,
      destinationCityCode: row.destinationCityCode,
      destinationCityName: row.destinationCityName,
      destinationState: row.destinationState,
      totalAmountCents: Math.round(numberValue(note.totals?.valorTotal) * 100),
      grossWeight: volume.grossWeight,
      netWeight: volume.netWeight,
      packageQuantity: volume.packageQuantity,
      eligibilityStatus: row.status,
      eligibilityReason: row.reasonMessage,
      reservationStatus: reservationByNfe.get(note.id)?.status || "AVAILABLE",
    };
  });
  const summary = Object.values(data.reduce((acc, item) => {
    const state = item.destinationState || "--";
    acc[state] ||= { state, documentCount: 0, municipalities: new Set(), totalAmountCents: 0, grossWeight: 0 };
    acc[state].documentCount += 1;
    acc[state].municipalities.add(item.destinationCityCode);
    acc[state].totalAmountCents += item.totalAmountCents;
    acc[state].grossWeight += item.grossWeight;
    return acc;
  }, {})).map((item) => ({ ...item, municipalityCount: item.municipalities.size, municipalities: undefined }));
  return { data, summary, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function nextMdfeNumber(tx, companyId, environment, series) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`mdfe:${companyId}:${environment}:${series}`})
    )::text AS "lockResult"
  `;
  const [row] = await tx.$queryRaw`
    SELECT COALESCE(MAX(
      CASE WHEN "number" ~ '^[0-9]+$' THEN "number"::bigint ELSE 0 END
    ), 0) AS "lastNumber"
    FROM "mdfe_drafts"
    WHERE "company_id" = ${companyId}::uuid
      AND "environment" = ${environment}
      AND "series" = ${series}
      AND "deleted_at" IS NULL
  `;
  return String(Number(row?.lastNumber || 0) + 1);
}

export async function prepareMdfesFromNfes({
  companyId,
  userId,
  nfeIds,
  departureAt,
  idempotencyKey,
  request,
}) {
  const uniqueIds = [...new Set(nfeIds)];
  if (!uniqueIds.length) throw new AppError("Selecione ao menos uma NF-e.", "MDFE_NFE_REQUIRED", 400);
  const ownReservations = await prisma.mdfeNfeReservation.findMany({
    where: { companyId, nfeDocumentId: { in: uniqueIds }, idempotencyKey },
    select: { nfeDocumentId: true, mdfeDraftId: true },
  });
  const ownMdfeByNfe = new Map(
    ownReservations.map((reservation) => [reservation.nfeDocumentId, reservation.mdfeDraftId]),
  );
  for (const nfeDocumentId of uniqueIds) {
    await evaluateNfeEligibility({
      companyId,
      nfeDocumentId,
      ignoreReservationIdempotencyKey: idempotencyKey,
      ignoreMdfeId: ownMdfeByNfe.get(nfeDocumentId) || null,
    });
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const certificate = await getCurrentCertificate(companyId).catch(() => null);

  return prisma.$transaction(async (tx) => {
    const operationalSettings = await tx.mdfeOperationalSetting.findMany({
      where: { companyId, isActive: true },
      include: { defaultVehicle: true, defaultDriver: true },
    });
    const eligibilities = await tx.mdfeNfeEligibility.findMany({
      where: { companyId, nfeDocumentId: { in: uniqueIds } },
      select: { id: true },
    });
    if (eligibilities.length !== uniqueIds.length) {
      throw new AppError("NF-e não encontrada.", "NFE_NOT_FOUND", 404);
    }
    await tx.$queryRaw`
      SELECT "id" FROM "mdfe_nfe_eligibilities"
      WHERE "id" IN (${Prisma.join(eligibilities.map((item) => item.id))})
      ORDER BY "id" FOR UPDATE
    `;
    const notes = await tx.nfeDocument.findMany({
      where: { id: { in: uniqueIds }, companyId, deletedAt: null },
      include: {
        mdfeEligibility: true,
        authorization: true,
        totals: true,
        transport: true,
        items: { where: { deletedAt: null } },
      },
    });
    if (notes.length !== uniqueIds.length) throw new AppError("NF-e não encontrada.", "NFE_NOT_FOUND", 404);
    const invalid = notes.find((note) => !["ELIGIBLE", "RELEASED"].includes(note.mdfeEligibility?.status));
    if (invalid) {
      throw new AppError(
        invalid.mdfeEligibility?.reasonMessage || "NF-e inelegível.",
        invalid.mdfeEligibility?.reasonCode || "MDFE_NFE_INELIGIBLE",
        409,
      );
    }
    const existingReservation = await tx.mdfeNfeReservation.findFirst({
      where: {
        nfeDocumentId: { in: uniqueIds },
        status: { in: ACTIVE_RESERVATIONS },
        expiresAt: { gt: new Date() },
        idempotencyKey: { not: idempotencyKey },
      },
    });
    if (existingReservation) {
      throw new AppError("Uma NF-e foi reservada por outra operação.", "MDFE_NFE_CONCURRENT_RESERVATION", 409);
    }

    const groups = groupNfesForAutomaticMdfe(notes);
    const prepared = [];
    for (const [groupIndex, group] of groups.entries()) {
      const preparationKey = `${idempotencyKey}:${groupIndex + 1}`;
      const eligibility = group[0].mdfeEligibility;
      const setting = operationalSettings.find(
        (item) => item.establishmentId === eligibility.establishmentId,
      ) || operationalSettings.find((item) => item.establishmentId === null);
      const existing = await tx.mdfeDraft.findUnique({
        where: { companyId_automaticPreparationKey: { companyId, automaticPreparationKey: preparationKey } },
        include: {
          fiscalDocuments: true,
          unloadingCities: true,
          vehicle: true,
          drivers: true,
        },
      });
      if (existing) {
        const metadata = existing.predominantProductMetadata;
        const blockingIssues = [
          !existing.vehicle && "VEHICLE_REQUIRED",
          !existing.drivers.length && "DRIVER_REQUIRED",
          !existing.routeConfirmedAt && "ROUTE_CONFIRMATION_REQUIRED",
          !existing.predominantProduct && "PREDOMINANT_PRODUCT_REQUIRED",
          metadata?.requiresConfirmation && "PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED",
          !certificate && "CERTIFICATE_REQUIRED",
        ].filter(Boolean);
        prepared.push({
          mdfeId: existing.id,
          unloadingState: existing.unloadingState,
          loadingCityName: eligibility?.loadingCityName || null,
          loadingState: existing.loadingState,
          documentCount: existing.fiscalDocuments.length,
          municipalityCount: existing.unloadingCities.length,
          totalCargoCents: Number(existing.totalCargoCents),
          grossWeight: Number(existing.totalWeightKg),
          vehicleConfigured: Boolean(existing.vehicle),
          driverConfigured: existing.drivers.length > 0,
          routeConfigured: true,
          certificateReady: Boolean(certificate),
          blockingIssues,
          warnings: metadata?.confidence === "MEDIUM" ? 1 : 0,
          status: existing.status,
          idempotent: true,
        });
        continue;
      }
      const cities = [...new Map(group.map((note) => [
        note.mdfeEligibility.destinationCityCode,
        {
          cityCode: note.mdfeEligibility.destinationCityCode,
          cityName: note.mdfeEligibility.destinationCityName,
          stateCode: note.mdfeEligibility.destinationState,
        },
      ])).values()];
      const route = await mdfeRouteProvider.calculateRoutes({
        originCityCode: eligibility.loadingCityCode,
        originState: eligibility.loadingState,
        destinationCityCodes: cities.map((item) => item.cityCode),
        destinationState: eligibility.destinationState,
      });
      const predominant = calculatePredominantProduct(group);
      const volumes = group.map((note) => normalizeVolumeData(note.transport?.volumes));
      const totalCargoCents = group.reduce((sum, note) => sum + Math.round(numberValue(note.totals?.valorTotal) * 100), 0);
      const grossWeight = volumes.reduce((sum, item) => sum + item.grossWeight, 0);
      const netWeight = volumes.reduce((sum, item) => sum + item.netWeight, 0);
      const packages = volumes.reduce((sum, item) => sum + item.packageQuantity, 0);
      const series = setting?.defaultSeries || "1";
      const environment = setting?.environment || company.environment;
      const number = await nextMdfeNumber(tx, companyId, environment, series);
      const draft = await tx.mdfeDraft.create({
        data: {
          companyId,
          establishmentId: eligibility.establishmentId,
          series,
          number,
          environment,
          issuerType: setting?.issuerType || eligibility.issuerType,
          carrierType: setting?.carrierType || "PROPRIO",
          modal: setting?.modal || eligibility.transportMode,
          emissionDate: new Date(),
          tripStartAt: departureAt || null,
          loadingState: eligibility.loadingState,
          unloadingState: eligibility.destinationState,
          loadingCityCode: eligibility.loadingCityCode,
          totalCargoCents: String(totalCargoCents),
          totalWeightKg: String(grossWeight),
          totalNetWeightKg: String(netWeight),
          totalPackageQuantity: String(packages),
          cargoQuantity: String(grossWeight),
          predominantProduct: predominant?.description || null,
          predominantNcm: predominant?.ncm || null,
          predominantProductMetadata: predominant,
          routeSource: route.recommended.source,
          routeConfidence: route.recommended.confidence,
          routeConfirmedAt: route.recommended.requiresConfirmation ? null : new Date(),
          automaticPreparationKey: preparationKey,
          createdById: userId,
          tags: { automaticFromNfe: true },
        },
      });
      await tx.mdfeLoadingMunicipality.create({
        data: {
          companyId, mdfeDraftId: draft.id, sequence: 1,
          cityCode: eligibility.loadingCityCode,
          cityName: eligibility.loadingCityName,
          stateCode: eligibility.loadingState,
        },
      });
      await tx.mdfeUnloadingCity.createMany({
        data: cities.map((city, index) => ({ ...city, companyId, mdfeDraftId: draft.id, sequence: index + 1 })),
      });
      const unloadingRows = await tx.mdfeUnloadingCity.findMany({ where: { mdfeDraftId: draft.id } });
      const unloadingByCode = new Map(unloadingRows.map((item) => [item.cityCode, item]));
      const intermediateStates = route.recommended.states.slice(1, -1);
      if (intermediateStates.length) {
        await tx.mdfeRouteState.createMany({
          data: intermediateStates.map((stateCode, index) => ({
            companyId, mdfeDraftId: draft.id, stateCode, sequence: index + 1,
          })),
        });
      }
      await tx.mdfeFiscalDocumentLink.createMany({
        data: group.map((note, index) => {
          const cityCode = note.mdfeEligibility.destinationCityCode;
          const volume = normalizeVolumeData(note.transport?.volumes);
          return {
            companyId,
            mdfeDraftId: draft.id,
            documentType: "NFE",
            nfeDocumentId: note.id,
            unloadingCityId: unloadingByCode.get(cityCode)?.id,
            unloadingCityCode: cityCode,
            accessKey: note.chaveAcesso,
            documentNumber: String(note.numero || ""),
            series: String(note.serie || ""),
            grossWeight: String(volume.grossWeight),
            documentValue: String(numberValue(note.totals?.valorTotal)),
            linkSource: "AUTHORIZED_NFE_AUTOMATIC",
            sequence: index + 1,
          };
        }),
      });
      for (const note of group) {
        await tx.mdfeNfeReservation.upsert({
          where: { nfeDocumentId: note.id },
          create: {
            companyId, nfeDocumentId: note.id, mdfeDraftId: draft.id, userId,
            status: "LINKED_TO_DRAFT", idempotencyKey,
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
          update: {
            mdfeDraftId: draft.id, userId, status: "LINKED_TO_DRAFT", idempotencyKey,
            reservedAt: new Date(), expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
            releasedAt: null, releaseReason: null,
          },
        });
        await tx.mdfeNfeEligibility.update({
          where: { nfeDocumentId: note.id },
          data: { status: "LINKED_TO_DRAFT", version: { increment: 1 } },
        });
      }
      const defaultVehicle = setting?.defaultVehicle?.isActive
        && !setting.defaultVehicle.deletedAt ? setting.defaultVehicle : null;
      const vehicleSource = group.find((note) => note.transport?.placaVeiculo)?.transport;
      if (defaultVehicle || vehicleSource?.placaVeiculo) {
        await tx.mdfeVehicle.create({
          data: {
            companyId, mdfeDraftId: draft.id,
            plate: defaultVehicle?.plate
              || vehicleSource.placaVeiculo.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 7),
            plateState: defaultVehicle?.plateState || vehicleSource?.ufPlaca,
            renavam: defaultVehicle?.renavam || null,
            rntrc: setting?.rntrc || defaultVehicle?.rntrc || vehicleSource?.rntc,
            tareWeight: defaultVehicle?.tareWeight,
            capacityKg: defaultVehicle?.capacityKg,
            capacityM3: defaultVehicle?.capacityM3,
            wheelType: defaultVehicle?.wheelType,
            bodyType: defaultVehicle?.bodyType,
            ownerType: defaultVehicle?.ownerType,
            ownerName: defaultVehicle?.ownerName,
            ownerCpfCnpj: defaultVehicle?.ownerCpfCnpj,
            ownerStateRegistration: defaultVehicle?.ownerStateRegistration,
          },
        });
      }
      const defaultDriver = setting?.defaultDriver?.isActive
        && !setting.defaultDriver.deletedAt ? setting.defaultDriver : null;
      if (defaultDriver) {
        await tx.mdfeDriver.create({
          data: {
            companyId,
            mdfeDraftId: draft.id,
            cpf: defaultDriver.cpf,
            name: defaultDriver.name,
            phone: defaultDriver.phone,
            isPrimary: true,
            sequence: 1,
          },
        });
      }
      await tx.mdfeAuditLog.create({
        data: {
          companyId, mdfeDraftId: draft.id, action: "MDFE_AUTOMATIC_PREPARED",
          entityType: "MdfeDraft", entityId: draft.id, userId,
          requestId: request?.id || null,
          afterData: { nfeIds: group.map((note) => note.id), route: route.recommended, totalCargoCents },
        },
      });
      const blockingIssues = [
        !defaultVehicle && !vehicleSource?.placaVeiculo && "VEHICLE_REQUIRED",
        !defaultDriver && "DRIVER_REQUIRED",
        route.recommended.requiresConfirmation && "ROUTE_CONFIRMATION_REQUIRED",
        !predominant && "PREDOMINANT_PRODUCT_REQUIRED",
        predominant?.requiresConfirmation && "PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED",
        !certificate && "CERTIFICATE_REQUIRED",
      ].filter(Boolean);
      prepared.push({
        mdfeId: draft.id,
        unloadingState: eligibility.destinationState,
        loadingCityName: eligibility.loadingCityName,
        loadingState: eligibility.loadingState,
        documentCount: group.length,
        municipalityCount: cities.length,
        totalCargoCents,
        grossWeight,
        vehicleConfigured: Boolean(defaultVehicle || vehicleSource?.placaVeiculo),
        driverConfigured: Boolean(defaultDriver),
        routeConfigured: true,
        certificateReady: Boolean(certificate),
        blockingIssues,
        warnings: predominant?.confidence === "MEDIUM" ? 1 : 0,
        status: draft.status,
      });
    }
    return { groups: prepared, groupCount: prepared.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function reconcileAutomaticMdfeSnapshot({
  companyId,
  mdfeId,
  userId,
  request,
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "mdfe_drafts"
      WHERE "id" = ${mdfeId}::uuid AND "company_id" = ${companyId}::uuid
      FOR UPDATE
    `;
    const draft = await tx.mdfeDraft.findFirst({
      where: { id: mdfeId, companyId, deletedAt: null },
      include: { fiscalDocuments: true },
    });
    if (!draft) throw new AppError("MDF-e não encontrado.", "MDFE_NOT_FOUND", 404);
    const links = draft.fiscalDocuments.filter((item) => item.nfeDocumentId);
    if (!links.length) return draft;

    const notes = await tx.nfeDocument.findMany({
      where: {
        companyId,
        id: { in: links.map((item) => item.nfeDocumentId) },
        deletedAt: null,
      },
      include: {
        authorization: true,
        totals: true,
        transport: true,
        items: { where: { deletedAt: null } },
        mdfeEligibility: true,
      },
    });
    if (notes.length !== links.length) {
      throw new AppError(
        "Uma NF-e vinculada deixou de existir.",
        "MDFE_NFE_SNAPSHOT_INCOMPLETE",
        409,
      );
    }

    const linkByNfe = new Map(links.map((item) => [item.nfeDocumentId, item]));
    for (const note of notes) {
      if (note.status !== "AUTORIZADA" || note.cStat !== "100"
        || !note.protocolo || !note.authorization?.protocolo
        || (!note.xmlProtocolo && !note.authorization?.xmlProtocolo)) {
        throw new AppError(
          `A NF-e ${note.numero || note.id} perdeu a autorização fiscal válida.`,
          "NFE_NOT_AUTHORIZED",
          409,
        );
      }
      const link = linkByNfe.get(note.id);
      if (note.mdfeEligibility?.destinationCityCode !== link.unloadingCityCode) {
        throw new AppError(
          `O município da NF-e ${note.numero || note.id} diverge do snapshot do MDF-e.`,
          "MDFE_NFE_DESTINATION_DIVERGENCE",
          409,
        );
      }
    }

    const volumes = notes.map((note) => normalizeVolumeData(note.transport?.volumes));
    const totalCargoCents = notes.reduce(
      (sum, note) => sum + Math.round(numberValue(note.totals?.valorTotal) * 100),
      0,
    );
    const grossWeight = volumes.reduce((sum, item) => sum + item.grossWeight, 0);
    const netWeight = volumes.reduce((sum, item) => sum + item.netWeight, 0);
    const packages = volumes.reduce((sum, item) => sum + item.packageQuantity, 0);
    const calculatedPredominant = calculatePredominantProduct(notes);
    const previousPredominant = draft.predominantProductMetadata;
    const sameConfirmedProduct = Boolean(
      previousPredominant?.confirmedAt
      && previousPredominant.description === calculatedPredominant?.description
      && previousPredominant.ncm === calculatedPredominant?.ncm,
    );
    const predominant = calculatedPredominant
      ? {
          ...calculatedPredominant,
          ...(sameConfirmedProduct
            ? {
                requiresConfirmation: false,
                confirmedAt: previousPredominant.confirmedAt,
                confirmedBy: previousPredominant.confirmedBy,
              }
            : {}),
        }
      : null;

    await tx.mdfeDraft.update({
      where: { id: mdfeId },
      data: {
        totalCargoCents: String(totalCargoCents),
        totalWeightKg: String(grossWeight),
        totalNetWeightKg: String(netWeight),
        totalPackageQuantity: String(packages),
        cargoQuantity: String(grossWeight),
        predominantProduct: predominant?.description || null,
        predominantNcm: predominant?.ncm || null,
        predominantProductMetadata: predominant,
        version: { increment: 1 },
      },
    });
    for (const note of notes) {
      const volume = normalizeVolumeData(note.transport?.volumes);
      await tx.mdfeFiscalDocumentLink.update({
        where: { id: linkByNfe.get(note.id).id },
        data: {
          accessKey: note.chaveAcesso,
          documentNumber: String(note.numero || ""),
          series: String(note.serie || ""),
          grossWeight: String(volume.grossWeight),
          documentValue: String(numberValue(note.totals?.valorTotal)),
        },
      });
    }
    await tx.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: mdfeId,
        action: "MDFE_AUTOMATIC_SNAPSHOT_RECALCULATED",
        entityType: "MdfeDraft",
        entityId: mdfeId,
        userId,
        requestId: request?.id || null,
        afterData: {
          nfeIds: notes.map((note) => note.id),
          totalCargoCents,
          grossWeight,
          netWeight,
          packages,
          predominantProduct: predominant,
        },
      },
    });
    return { totalCargoCents, grossWeight, netWeight, packages, predominant };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function saveAndAuthorizeAutomaticMdfe({
  companyId,
  mdfeId,
  userId,
  idempotencyKey,
  confirmRoute,
  confirmPredominantProduct,
  request,
}) {
  let mdfe = await getMdfe(companyId, mdfeId);
  const nfeLinks = mdfe.fiscalDocuments.filter((item) => item.nfeDocumentId);
  if (nfeLinks.length) {
    for (const link of nfeLinks) {
      const eligibility = await evaluateNfeEligibility({
        companyId,
        nfeDocumentId: link.nfeDocumentId,
        ignoreMdfeId: mdfeId,
      });
      if (!["ELIGIBLE", "INELIGIBLE"].includes(eligibility.status)) continue;
      if (eligibility.status === "INELIGIBLE" && eligibility.reasonCode !== "NFE_RESERVED") {
        throw new AppError(eligibility.reasonMessage, eligibility.reasonCode, 409);
      }
    }
    const reservations = await prisma.mdfeNfeReservation.count({
      where: {
        companyId, mdfeDraftId: mdfeId,
        nfeDocumentId: { in: nfeLinks.map((item) => item.nfeDocumentId) },
        status: { in: ["LINKED_TO_DRAFT", "LINKED_TO_ACTIVE_MDFE"] },
      },
    });
    if (reservations !== nfeLinks.length) {
      throw new AppError("Reserva das NF-e inválida.", "MDFE_NFE_RESERVATION_INVALID", 409);
    }
    await reconcileAutomaticMdfeSnapshot({ companyId, mdfeId, userId, request });
    mdfe = await getMdfe(companyId, mdfeId);
  }
  if (mdfe.routeSource?.startsWith("DETERMINISTIC_FALLBACK") && !mdfe.routeConfirmedAt) {
    if (!confirmRoute) {
      throw new AppError("Confirme o percurso sugerido antes de transmitir.", "MDFE_ROUTE_CONFIRMATION_REQUIRED", 409);
    }
    await prisma.mdfeDraft.update({ where: { id: mdfeId }, data: { routeConfirmedAt: new Date() } });
  }
  if (mdfe.predominantProductMetadata?.requiresConfirmation) {
    if (!confirmPredominantProduct) {
      throw new AppError(
        "Confirme o produto predominante calculado antes de transmitir.",
        "MDFE_PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED",
        409,
      );
    }
    await prisma.mdfeDraft.update({
      where: { id: mdfeId },
      data: {
        predominantProductMetadata: {
          ...mdfe.predominantProductMetadata,
          requiresConfirmation: false,
          confirmedAt: new Date().toISOString(),
          confirmedBy: userId,
        },
      },
    });
  }
  const validation = await validateMdfeDraft({ companyId, mdfeId, userId, request });
  if (!validation.valid) return { authorized: false, validation };
  const authorization = await authorizeMdfe({
    companyId, mdfeId, userId, idempotencyKey, request,
  });
  const updated = await getMdfe(companyId, mdfeId);
  if (updated.status === "AUTHORIZED") {
    await prisma.$transaction([
      prisma.mdfeNfeReservation.updateMany({
        where: { companyId, mdfeDraftId: mdfeId },
        data: { status: "LINKED_TO_ACTIVE_MDFE", expiresAt: new Date("9999-12-31T23:59:59.999Z") },
      }),
      prisma.mdfeNfeEligibility.updateMany({
        where: { companyId, nfeDocumentId: { in: nfeLinks.map((item) => item.nfeDocumentId) } },
        data: { status: "LINKED_TO_ACTIVE_MDFE", version: { increment: 1 } },
      }),
    ]);
  }
  return { authorized: updated.status === "AUTHORIZED", authorization, mdfe: updated };
}
