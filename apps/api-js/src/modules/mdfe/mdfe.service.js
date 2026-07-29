import { XMLBuilder } from "fast-xml-parser";
import QRCode from "qrcode";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import {
  lookupCompanyFiscalData,
  resolveIbgeCode,
} from "../../services/cnpj-lookup.service.js";
import {
  getCurrentCertificate,
  loadCertificateSecret,
  loadCertificateSigningMaterial,
  serializeCertificate,
} from "../../services/certificate-vault.service.js";
import { signMdfeEventXml, signMdfeXml } from "../../services/xml-signature.service.js";
import { AppError } from "../../utils/app-error.js";
import {
  assertMdfeTransition,
  buildMdfeAccessKey,
  buildMdfeXml,
  generateNumericCode,
  isValidCpf,
  MDFE_LAYOUT_VERSION,
  MDFE_SCHEMA_VERSION,
  mdfeUfCode,
  normalizeTaxId,
  onlyDigits,
  sha256,
  validateMdfe,
} from "./mdfe.domain.js";
import { svrsMdfeGateway } from "./mdfe.gateway.js";
import {
  validateMdfeEventXmlWithXsd,
  validateMdfeXmlWithXsd,
} from "./mdfe.xsd.js";

const EDITABLE_STATUSES = new Set(["DRAFT", "VALIDATION_FAILED", "REJECTED", "ERROR"]);
const ACTIVE_STATUSES = new Set([
  "READY_TO_AUTHORIZE",
  "SIGNING",
  "SIGNED",
  "AUTHORIZING",
  "AUTHORIZED",
  "IN_TRANSIT",
  "CANCELLING",
  "CLOSING",
]);

const detailInclude = {
  loadingMunicipalities: { orderBy: { sequence: "asc" } },
  routeStates: { orderBy: { sequence: "asc" } },
  unloadingCities: { orderBy: { sequence: "asc" } },
  vehicle: true,
  trailers: { orderBy: { sequence: "asc" } },
  drivers: { orderBy: { sequence: "asc" } },
  fiscalDocuments: { orderBy: { sequence: "asc" } },
  contractors: { orderBy: { sequence: "asc" } },
  ciots: { orderBy: { sequence: "asc" } },
  tollVouchers: { orderBy: { sequence: "asc" } },
  payments: {
    orderBy: { sequence: "asc" },
    include: { components: { orderBy: { sequence: "asc" } } },
  },
  insurances: {
    orderBy: { sequence: "asc" },
    include: { endorsements: { orderBy: { createdAt: "asc" } } },
  },
  seals: { orderBy: { sequence: "asc" } },
  validationRuns: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { issues: { orderBy: { createdAt: "asc" } } },
  },
  events: { orderBy: { createdAt: "desc" } },
  transmissionAttempts: { orderBy: { createdAt: "desc" }, take: 20 },
  xmlArtifacts: { orderBy: { createdAt: "desc" } },
  auditLogs: { orderBy: { createdAt: "desc" }, take: 100 },
};

function decimalString(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).replace(",", ".");
}

function centsString(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).replace(/\D/g, "") || "0";
}

function toEnvironment(company) {
  return company.environment === "production" ? "production" : "homologation";
}

function requestMetadata(request) {
  return {
    requestId: request?.id || null,
    ipAddress: request?.ip || null,
    userAgent: request?.get?.("user-agent") || null,
  };
}

function assertEditable(mdfe) {
  if (!EDITABLE_STATUSES.has(mdfe.status)) {
    throw new AppError(
      "O MDF-e não pode ser alterado neste status.",
      "MDFE_STATUS_LOCKED",
      409,
    );
  }
}

async function getCompanyOrThrow(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
  return company;
}

async function loadMdfeIssuer(companyId) {
  const company = await getCompanyOrThrow(companyId);
  let fiscalData = null;
  try {
    fiscalData = await lookupCompanyFiscalData(company.cnpj);
  } catch {
    fiscalData = null;
  }
  const source = fiscalData?.empresa || {};
  const city = source.cidade || company.city;
  const uf = source.uf || company.uf;
  const cityCode = await resolveIbgeCode(city, uf, source.cep || null);
  return {
    ...company,
    address: {
      street: source.endereco || null,
      number: source.numero || null,
      complement: source.complemento || null,
      district: source.bairro || null,
      cityCode,
      city,
      uf,
      cep: source.cep || null,
      phone: source.telefone || null,
    },
  };
}

export async function getMdfe(companyId, mdfeId, client = prisma) {
  const mdfe = await client.mdfeDraft.findFirst({
    where: { id: mdfeId, companyId, deletedAt: null },
    include: detailInclude,
  });
  if (!mdfe) throw new AppError("MDF-e não encontrado.", "MDFE_NOT_FOUND", 404);
  return mdfe;
}

async function nextNumber(tx, companyId, environment, series) {
  const rows = await tx.mdfeDraft.findMany({
    where: { companyId, environment, series, number: { not: null } },
    select: { number: true },
  });
  return String(
    rows.reduce((highest, row) => Math.max(highest, Number(row.number) || 0), 0) + 1,
  );
}

function scalarData(payload) {
  const keys = [
    "series",
    "number",
    "issuerType",
    "carrierType",
    "modal",
    "emissionType",
    "emissionDate",
    "tripStartAt",
    "loadingAfter",
    "loadingState",
    "unloadingState",
    "currentStep",
    "cargoUnit",
    "predominantProduct",
    "predominantCargoType",
    "predominantNcm",
    "loadingCep",
    "unloadingCep",
    "additionalInfo",
    "fiscalInfo",
    "internalInfo",
    "internalReference",
    "tags",
  ];
  const result = {};
  for (const key of keys) {
    if (payload[key] !== undefined) result[key] = payload[key];
  }
  if (payload.cargoQuantity !== undefined) {
    result.cargoQuantity = decimalString(payload.cargoQuantity);
  }
  return result;
}

async function validateDocumentSources(tx, companyId, documents) {
  const nfeIds = documents.map((item) => item.nfeEntryId).filter(Boolean);
  const issuedNfeIds = documents.map((item) => item.nfeDocumentId).filter(Boolean);
  const cteIds = documents.map((item) => item.cteEntryId).filter(Boolean);
  if (nfeIds.length) {
    const count = await tx.nfeEntry.count({
      where: { id: { in: nfeIds }, companyId, status: "AUTHORIZED" },
    });
    if (count !== new Set(nfeIds).size) {
      throw new AppError(
        "Uma ou mais NF-e não pertencem à empresa ou não estão autorizadas.",
        "MDFE_NFE_SOURCE_INVALID",
        422,
      );
    }
  }
  if (issuedNfeIds.length) {
    const count = await tx.nfeDocument.count({
      where: {
        id: { in: issuedNfeIds },
        companyId,
        status: "AUTORIZADA",
        cStat: "100",
        protocolo: { not: null },
        xmlProtocolo: { not: null },
        deletedAt: null,
      },
    });
    if (count !== new Set(issuedNfeIds).size) {
      throw new AppError(
        "Uma ou mais NF-e emitidas não pertencem à empresa ou não estão autorizadas.",
        "MDFE_ISSUED_NFE_SOURCE_INVALID",
        422,
      );
    }
  }
  if (cteIds.length) {
    const count = await tx.cteEntry.count({
      where: { id: { in: cteIds }, companyId, status: "AUTHORIZED" },
    });
    if (count !== new Set(cteIds).size) {
      throw new AppError(
        "Um ou mais CT-e não pertencem à empresa ou não estão autorizados.",
        "MDFE_CTE_SOURCE_INVALID",
        422,
      );
    }
  }
  const keys = documents.map((item) => item.accessKey);
  const activeLink = await tx.mdfeFiscalDocumentLink.findFirst({
    where: {
      companyId,
      accessKey: { in: keys },
      mdfeDraft: { status: { in: [...ACTIVE_STATUSES] }, deletedAt: null },
    },
    select: { accessKey: true, mdfeDraftId: true },
  });
  if (activeLink) {
    throw new AppError(
      `O documento ${activeLink.accessKey} já está vinculado a um MDF-e ativo.`,
      "MDFE_DOCUMENT_ALREADY_ACTIVE",
      409,
    );
  }
}

async function replaceNested(tx, mdfe, payload) {
  const { id: mdfeDraftId, companyId } = mdfe;
  if (payload.loadingMunicipalities !== undefined) {
    await tx.mdfeLoadingMunicipality.deleteMany({ where: { mdfeDraftId } });
    if (payload.loadingMunicipalities.length) {
      await tx.mdfeLoadingMunicipality.createMany({
        data: payload.loadingMunicipalities.map((item, index) => ({
          ...item,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        })),
      });
    }
  }
  if (payload.routeStates !== undefined) {
    await tx.mdfeRouteState.deleteMany({ where: { mdfeDraftId } });
    if (payload.routeStates.length) {
      await tx.mdfeRouteState.createMany({
        data: payload.routeStates.map((stateCode, index) => ({
          companyId,
          mdfeDraftId,
          stateCode,
          sequence: index + 1,
        })),
      });
    }
  }
  if (payload.unloadingCities !== undefined) {
    if (await tx.mdfeFiscalDocumentLink.count({ where: { mdfeDraftId } })) {
      await tx.mdfeFiscalDocumentLink.updateMany({
        where: { mdfeDraftId },
        data: { unloadingCityId: null },
      });
    }
    await tx.mdfeUnloadingCity.deleteMany({ where: { mdfeDraftId } });
    if (payload.unloadingCities.length) {
      await tx.mdfeUnloadingCity.createMany({
        data: payload.unloadingCities.map((item, index) => ({
          ...item,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        })),
      });
    }
  }
  if (payload.vehicle !== undefined) {
    if (!payload.vehicle) {
      await tx.mdfeVehicle.deleteMany({ where: { mdfeDraftId } });
    } else {
      await tx.mdfeVehicle.upsert({
        where: { mdfeDraftId },
        create: {
          ...payload.vehicle,
          tareWeight: decimalString(payload.vehicle.tareWeight),
          capacityKg: decimalString(payload.vehicle.capacityKg),
          capacityM3: decimalString(payload.vehicle.capacityM3),
          companyId,
          mdfeDraftId,
        },
        update: {
          ...payload.vehicle,
          tareWeight: decimalString(payload.vehicle.tareWeight),
          capacityKg: decimalString(payload.vehicle.capacityKg),
          capacityM3: decimalString(payload.vehicle.capacityM3),
        },
      });
    }
  }
  if (payload.trailers !== undefined) {
    await tx.mdfeTrailer.deleteMany({ where: { mdfeDraftId } });
    for (const [index, trailer] of payload.trailers.entries()) {
      await tx.mdfeTrailer.create({
        data: {
          ...trailer,
          tareWeight: decimalString(trailer.tareWeight),
          capacityKg: decimalString(trailer.capacityKg),
          capacityM3: decimalString(trailer.capacityM3),
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        },
      });
    }
  }
  if (payload.drivers !== undefined) {
    await tx.mdfeDriver.deleteMany({ where: { mdfeDraftId } });
    if (payload.drivers.length) {
      await tx.mdfeDriver.createMany({
        data: payload.drivers.map((driver, index) => ({
          ...driver,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        })),
      });
    }
  }
  if (payload.fiscalDocuments !== undefined) {
    await validateDocumentSources(tx, companyId, payload.fiscalDocuments);
    await tx.mdfeFiscalDocumentLink.deleteMany({ where: { mdfeDraftId } });
    for (const [index, document] of payload.fiscalDocuments.entries()) {
      await tx.mdfeFiscalDocumentLink.create({
        data: {
          ...document,
          grossWeight: decimalString(document.grossWeight),
          documentValue: decimalString(document.documentValue),
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        },
      });
    }
    const totalCargoCents = payload.fiscalDocuments.reduce(
      (total, document) => total + Math.round(Number(document.documentValue || 0) * 100),
      0,
    );
    const totalWeightKg = payload.fiscalDocuments.reduce(
      (total, document) => total + Number(document.grossWeight || 0),
      0,
    );
    await tx.mdfeDraft.update({
      where: { id: mdfeDraftId },
      data: {
        totalCargoCents: String(totalCargoCents),
        totalWeightKg: String(totalWeightKg),
      },
    });
  }
  if (payload.contractors !== undefined) {
    await tx.mdfePaymentComponent.deleteMany({ where: { payment: { mdfeDraftId } } });
    await tx.mdfePayment.deleteMany({ where: { mdfeDraftId } });
    await tx.mdfeCiot.deleteMany({ where: { mdfeDraftId } });
    await tx.mdfeContractor.deleteMany({ where: { mdfeDraftId } });
    if (payload.contractors.length) {
      await tx.mdfeContractor.createMany({
        data: payload.contractors.map((contractor, index) => ({
          ...contractor,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        })),
      });
    }
  }
  if (payload.ciots !== undefined) {
    await tx.mdfeCiot.deleteMany({ where: { mdfeDraftId } });
    for (const [index, ciot] of payload.ciots.entries()) {
      await tx.mdfeCiot.create({
        data: { ...ciot, companyId, mdfeDraftId, sequence: index + 1 },
      });
    }
  }
  if (payload.tollVouchers !== undefined) {
    await tx.mdfeTollVoucher.deleteMany({ where: { mdfeDraftId } });
    for (const [index, voucher] of payload.tollVouchers.entries()) {
      await tx.mdfeTollVoucher.create({
        data: {
          ...voucher,
          amountCents: centsString(voucher.amountCents),
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        },
      });
    }
  }
  if (payload.payments !== undefined) {
    await tx.mdfePaymentComponent.deleteMany({ where: { payment: { mdfeDraftId } } });
    await tx.mdfePayment.deleteMany({ where: { mdfeDraftId } });
    for (const [index, payment] of payload.payments.entries()) {
      const { components, ...paymentData } = payment;
      await tx.mdfePayment.create({
        data: {
          ...paymentData,
          amountCents: centsString(payment.amountCents),
          companyId,
          mdfeDraftId,
          sequence: index + 1,
          components: {
            create: components.map((component, componentIndex) => ({
              ...component,
              amountCents: centsString(component.amountCents),
              companyId,
              sequence: componentIndex + 1,
            })),
          },
        },
      });
    }
  }
  if (payload.insurances !== undefined) {
    await tx.mdfeInsuranceEndorsement.deleteMany({
      where: { mdfeInsurance: { mdfeDraftId } },
    });
    await tx.mdfeInsurance.deleteMany({ where: { mdfeDraftId } });
    for (const [index, insurance] of payload.insurances.entries()) {
      const { endorsements, ...insuranceData } = insurance;
      await tx.mdfeInsurance.create({
        data: {
          ...insuranceData,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
          endorsements: {
            create: endorsements.map((endorsementNumber) => ({
              companyId,
              endorsementNumber,
            })),
          },
        },
      });
    }
  }
  if (payload.seals !== undefined) {
    await tx.mdfeSeal.deleteMany({ where: { mdfeDraftId } });
    if (payload.seals.length) {
      await tx.mdfeSeal.createMany({
        data: payload.seals.map((seal, index) => ({
          ...seal,
          companyId,
          mdfeDraftId,
          sequence: index + 1,
        })),
      });
    }
  }
}

export async function createMdfe({ companyId, userId, payload, request }) {
  const company = await getCompanyOrThrow(companyId);
  return prisma.$transaction(async (tx) => {
    const number =
      payload.number || (await nextNumber(tx, companyId, company.environment, payload.series));
    const created = await tx.mdfeDraft.create({
      data: {
        ...scalarData({ ...payload, number }),
        companyId,
        environment: company.environment,
        emissionDate: payload.emissionDate || new Date(),
        processVersion: env.MDFE_PROCESS_VERSION,
        createdById: userId,
      },
    });
    await replaceNested(tx, created, payload);
    await tx.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: created.id,
        action: "MDFE_DRAFT_CREATED",
        entityType: "MdfeDraft",
        entityId: created.id,
        afterData: { number, series: payload.series },
        userId,
        ...requestMetadata(request),
      },
    });
    return getMdfe(companyId, created.id, tx);
  });
}

export async function updateMdfe({ companyId, mdfeId, userId, payload, request }) {
  return prisma.$transaction(async (tx) => {
    const current = await getMdfe(companyId, mdfeId, tx);
    assertEditable(current);
    await tx.mdfeDraft.update({
      where: { id: current.id },
      data: {
        ...scalarData(payload),
        status: "DRAFT",
        statusCode: null,
        statusReason: null,
        updatedById: userId,
        version: { increment: 1 },
      },
    });
    await replaceNested(tx, current, payload);
    await tx.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: current.id,
        action: "MDFE_DRAFT_UPDATED",
        entityType: "MdfeDraft",
        entityId: current.id,
        beforeData: { version: current.version, status: current.status },
        afterData: { version: current.version + 1, fields: Object.keys(payload) },
        userId,
        ...requestMetadata(request),
      },
    });
    return getMdfe(companyId, current.id, tx);
  });
}

export async function listMdfe(companyId, query) {
  const where = { companyId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.environment) where.environment = query.environment;
  if (query.loadingState) where.loadingState = query.loadingState;
  if (query.unloadingState) where.unloadingState = query.unloadingState;
  if (query.modal) where.modal = query.modal;
  if (query.issuerType) where.issuerType = query.issuerType;
  if (query.startDate || query.endDate) {
    where.emissionDate = {};
    if (query.startDate) where.emissionDate.gte = query.startDate;
    if (query.endDate) where.emissionDate.lte = query.endDate;
  }
  if (query.search) {
    const value = query.search.trim();
    where.OR = [
      { number: { contains: value } },
      { accessKey: { contains: onlyDigits(value) || value } },
      { vehicle: { is: { plate: { contains: value.toUpperCase() } } } },
      { drivers: { some: { name: { contains: value, mode: "insensitive" } } } },
      { unloadingCities: { some: { cityName: { contains: value, mode: "insensitive" } } } },
    ];
  }
  const [items, total, grouped] = await prisma.$transaction([
    prisma.mdfeDraft.findMany({
      where,
      include: {
        vehicle: true,
        drivers: { where: { isPrimary: true }, take: 1 },
        _count: { select: { fiscalDocuments: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.mdfeDraft.count({ where }),
    prisma.mdfeDraft.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  return {
    data: items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
    summary: Object.fromEntries(grouped.map((item) => [item.status, item._count._all])),
  };
}

export async function deleteMdfeDraft({ companyId, mdfeId, userId, request }) {
  const mdfe = await getMdfe(companyId, mdfeId);
  if (mdfe.status !== "DRAFT") {
    throw new AppError("Somente rascunhos podem ser excluídos.", "MDFE_DELETE_FORBIDDEN", 409);
  }
  await prisma.$transaction([
    prisma.mdfeDraft.update({ where: { id: mdfe.id }, data: { deletedAt: new Date() } }),
    prisma.mdfeNfeReservation.updateMany({
      where: { companyId, mdfeDraftId: mdfe.id, status: "LINKED_TO_DRAFT" },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
        releaseReason: "MDF-e draft deleted",
      },
    }),
    prisma.mdfeNfeEligibility.updateMany({
      where: {
        companyId,
        nfeDocumentId: {
          in: mdfe.fiscalDocuments.map((item) => item.nfeDocumentId).filter(Boolean),
        },
      },
      data: { status: "RELEASED", version: { increment: 1 } },
    }),
    prisma.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: mdfe.id,
        action: "MDFE_DRAFT_DELETED",
        entityType: "MdfeDraft",
        entityId: mdfe.id,
        userId,
        ...requestMetadata(request),
      },
    }),
  ]);
  return { ok: true };
}

export async function duplicateMdfe({ companyId, mdfeId, userId, request }) {
  const source = await getMdfe(companyId, mdfeId);
  const payload = {
    series: source.series,
    number: null,
    issuerType: source.issuerType,
    carrierType: source.carrierType,
    modal: source.modal,
    emissionType: source.emissionType,
    loadingAfter: source.loadingAfter,
    loadingState: source.loadingState,
    unloadingState: source.unloadingState,
    cargoUnit: source.cargoUnit,
    cargoQuantity: source.cargoQuantity,
    predominantProduct: source.predominantProduct,
    predominantCargoType: source.predominantCargoType,
    predominantNcm: source.predominantNcm,
    loadingCep: source.loadingCep,
    unloadingCep: source.unloadingCep,
    additionalInfo: source.additionalInfo,
    fiscalInfo: source.fiscalInfo,
    internalInfo: source.internalInfo,
    internalReference: source.internalReference,
    tags: source.tags,
    currentStep: 1,
    loadingMunicipalities: source.loadingMunicipalities.map((item) => ({
      stateCode: item.stateCode,
      cityCode: item.cityCode,
      cityName: item.cityName,
      expectedAt: item.expectedAt,
      internalNote: item.internalNote,
    })),
    routeStates: source.routeStates.map((item) => item.stateCode),
    unloadingCities: source.unloadingCities.map((item) => ({
      stateCode: item.stateCode,
      cityCode: item.cityCode,
      cityName: item.cityName,
    })),
    vehicle: source.vehicle && {
      plate: source.vehicle.plate,
      plateState: source.vehicle.plateState,
      renavam: source.vehicle.renavam,
      rntrc: source.vehicle.rntrc,
      tareWeight: source.vehicle.tareWeight,
      capacityKg: source.vehicle.capacityKg,
      capacityM3: source.vehicle.capacityM3,
      wheelType: source.vehicle.wheelType,
      bodyType: source.vehicle.bodyType,
      ownerType: source.vehicle.ownerType,
      ownerName: source.vehicle.ownerName,
      ownerCpfCnpj: source.vehicle.ownerCpfCnpj,
      ownerStateRegistration: source.vehicle.ownerStateRegistration,
    },
    trailers: source.trailers.map((item) => ({
      plate: item.plate,
      plateState: item.plateState,
      renavam: item.renavam,
      rntrc: item.rntrc,
      tareWeight: item.tareWeight,
      capacityKg: item.capacityKg,
      capacityM3: item.capacityM3,
      wheelType: item.wheelType,
      bodyType: item.bodyType,
      ownerType: item.ownerType,
      ownerName: item.ownerName,
      ownerCpfCnpj: item.ownerCpfCnpj,
      ownerStateRegistration: item.ownerStateRegistration,
    })),
    drivers: source.drivers.map((item) => ({
      cpf: item.cpf,
      name: item.name,
      phone: item.phone,
      isPrimary: item.isPrimary,
    })),
    fiscalDocuments: source.fiscalDocuments.map((item) => ({
      documentType: item.documentType,
      nfeEntryId: item.nfeEntryId,
      nfeDocumentId: item.nfeDocumentId,
      cteEntryId: item.cteEntryId,
      accessKey: item.accessKey,
      documentNumber: item.documentNumber,
      series: item.series,
      unloadingCityCode: item.unloadingCityCode,
      grossWeight: item.grossWeight,
      documentValue: item.documentValue,
      linkSource: item.linkSource,
    })),
    contractors: source.contractors.map((item) => ({
      taxId: item.taxId,
      name: item.name,
      role: item.role,
    })),
    ciots: source.ciots.map((item) => ({
      contractorId: null,
      number: item.number,
      responsibleTaxId: item.responsibleTaxId,
      status: item.status,
      internalNote: item.internalNote,
    })),
    tollVouchers: source.tollVouchers.map((item) => ({
      providerName: item.providerName,
      providerCnpj: item.providerCnpj,
      purchaseNumber: item.purchaseNumber,
      amountCents: item.amountCents,
      paymentDevice: item.paymentDevice,
      category: item.category,
    })),
    payments: source.payments.map((item) => ({
      contractorId: null,
      responsibleTaxId: item.responsibleTaxId,
      paymentMethod: item.paymentMethod,
      paymentTiming: item.paymentTiming,
      amountCents: item.amountCents,
      bankCode: item.bankCode,
      branchCode: item.branchCode,
      accountNumber: item.accountNumber,
      components: item.components.map((component) => ({
        type: component.type,
        description: component.description,
        amountCents: component.amountCents,
      })),
    })),
    insurances: source.insurances.map((item) => ({
      responsibleType: item.responsibleType,
      responsibleCpfCnpj: item.responsibleCpfCnpj,
      insurerName: item.insurerName,
      insurerCnpj: item.insurerCnpj,
      policyNumber: item.policyNumber,
      endorsements: item.endorsements.map((endorsement) => endorsement.endorsementNumber),
    })),
    seals: source.seals.map((item) => ({ number: item.number, note: item.note })),
  };
  return createMdfe({ companyId, userId, payload, request });
}

export async function validateMdfeDraft({ companyId, mdfeId, userId, request }) {
  const certificate = serializeCertificate(await getCurrentCertificate(companyId));
  return prisma.$transaction(async (tx) => {
    const mdfe = await getMdfe(companyId, mdfeId, tx);
    assertMdfeTransition(mdfe.status, "VALIDATING");
    await tx.mdfeDraft.update({ where: { id: mdfe.id }, data: { status: "VALIDATING" } });
    const result = validateMdfe(mdfe, { certificate });
    const nextStatus = result.valid ? "READY_TO_AUTHORIZE" : "VALIDATION_FAILED";
    const run = await tx.mdfeValidationRun.create({
      data: {
        companyId,
        mdfeDraftId: mdfe.id,
        version: mdfe.version,
        status: nextStatus,
        isValid: result.valid,
        blockingIssuesCount: result.blockingIssuesCount,
        warningIssuesCount: result.warningIssuesCount,
        calculationHash: sha256(JSON.stringify({
          version: mdfe.version,
          documents: mdfe.fiscalDocuments.map((item) => item.accessKey),
          totals: String(mdfe.totalCargoCents),
        })),
        requestedById: userId,
        requestId: request?.id || null,
        completedAt: new Date(),
        issues: {
          create: result.issues.map((item) => ({
            companyId,
            code: item.code,
            title: item.title,
            message: item.message,
            severity: item.severity,
            field: item.fieldPath || null,
            correctionType: item.correctionType,
            canAutoFix: item.correctionType === "AUTO_SAFE",
            suggestedAction: item.suggestedAction || null,
            metadata: {
              category: item.category,
              officialRuleReference: item.officialRuleReference,
            },
          })),
        },
      },
    });
    await tx.mdfeDraft.update({
      where: { id: mdfe.id },
      data: { status: nextStatus, statusReason: result.valid ? null : "Validação bloqueada." },
    });
    await tx.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: mdfe.id,
        action: result.valid ? "MDFE_VALIDATED" : "MDFE_VALIDATION_FAILED",
        entityType: "MdfeValidationRun",
        entityId: run.id,
        afterData: {
          blockingIssuesCount: result.blockingIssuesCount,
          warningIssuesCount: result.warningIssuesCount,
        },
        userId,
        ...requestMetadata(request),
      },
    });
    return { ...result, status: nextStatus, validationRunId: run.id, certificate };
  });
}

async function ensureAccessKey(mdfe, company) {
  if (mdfe.accessKey) return mdfe;
  const numericCode = mdfe.numericCode || generateNumericCode();
  const accessKey = buildMdfeAccessKey({
    uf: mdfe.loadingState,
    emissionDate: mdfe.emissionDate || mdfe.createdAt,
    cnpj: company.cnpj,
    series: mdfe.series,
    number: mdfe.number,
    emissionType: mdfe.emissionType === "NORMAL" ? "1" : mdfe.emissionType,
    numericCode,
  });
  return prisma.mdfeDraft.update({
    where: { id: mdfe.id },
    data: {
      numericCode,
      accessKey,
      checkDigit: accessKey.slice(-1),
    },
    include: detailInclude,
  });
}

async function storeXmlArtifact({
  companyId,
  mdfeId,
  kind,
  content,
  processVersion,
  client = prisma,
}) {
  const hashSha256 = sha256(content);
  return client.mdfeXmlArtifact.upsert({
    where: {
      mdfeDraftId_kind_hashSha256: {
        mdfeDraftId: mdfeId,
        kind,
        hashSha256,
      },
    },
    create: {
      companyId,
      mdfeDraftId: mdfeId,
      kind,
      layoutVersion: MDFE_LAYOUT_VERSION,
      schemaVersion: env.MDFE_SCHEMA_VERSION || MDFE_SCHEMA_VERSION,
      processVersion,
      content,
      hashSha256,
    },
    update: {},
  });
}

export async function generateMdfeXml({ companyId, mdfeId, userId, request }) {
  const company = await loadMdfeIssuer(companyId);
  let mdfe = await getMdfe(companyId, mdfeId);
  if (!["READY_TO_AUTHORIZE", "SIGNING", "SIGNED"].includes(mdfe.status)) {
    throw new AppError(
      "Valide o MDF-e antes de gerar o XML fiscal.",
      "MDFE_NOT_READY_FOR_XML",
      409,
    );
  }
  mdfe = await ensureAccessKey(mdfe, company);
  const xml = buildMdfeXml(mdfe, company);
  const artifact = await storeXmlArtifact({
    companyId,
    mdfeId: mdfe.id,
    kind: "GENERATED",
    content: xml,
    processVersion: mdfe.processVersion,
  });
  await prisma.mdfeAuditLog.create({
    data: {
      companyId,
      mdfeDraftId: mdfe.id,
      action: "MDFE_XML_GENERATED",
      entityType: "MdfeXmlArtifact",
      entityId: artifact.id,
      afterData: { hashSha256: artifact.hashSha256, schemaVersion: artifact.schemaVersion },
      userId,
      ...requestMetadata(request),
    },
  });
  return {
    xml,
    artifact,
    xsd: {
      valid: null,
      pendingSignature: true,
      message: "A validação XSD integral ocorre após a assinatura XMLDSig.",
    },
  };
}

export async function signMdfe({ companyId, mdfeId, userId, request }) {
  const mdfe = await getMdfe(companyId, mdfeId);
  assertMdfeTransition(mdfe.status, "SIGNING");
  await prisma.mdfeDraft.update({ where: { id: mdfe.id }, data: { status: "SIGNING" } });
  try {
    const generated = await generateMdfeXml({ companyId, mdfeId, userId, request });
    const material = await loadCertificateSigningMaterial(companyId);
    const signedXml = signMdfeXml(
      generated.xml,
      material.privateKeyPem,
      material.certificatePem,
    );
    const xsd = await validateMdfeXmlWithXsd(signedXml);
    if (!xsd.valid) {
      throw new AppError(
        "O XML assinado não passou na validação XSD.",
        "MDFE_SIGNED_XSD_VALIDATION_FAILED",
        422,
        xsd.errors.slice(0, 50),
      );
    }
    const artifact = await storeXmlArtifact({
      companyId,
      mdfeId,
      kind: "SIGNED",
      content: signedXml,
      processVersion: mdfe.processVersion,
    });
    await prisma.$transaction([
      prisma.mdfeDraft.update({ where: { id: mdfe.id }, data: { status: "SIGNED" } }),
      prisma.mdfeAuditLog.create({
        data: {
          companyId,
          mdfeDraftId: mdfe.id,
          action: "MDFE_XML_SIGNED",
          entityType: "MdfeXmlArtifact",
          entityId: artifact.id,
          afterData: { hashSha256: artifact.hashSha256 },
          userId,
          ...requestMetadata(request),
        },
      }),
    ]);
    return { signedXml, artifact };
  } catch (error) {
    await prisma.mdfeDraft.update({
      where: { id: mdfe.id },
      data: { status: "ERROR", statusReason: error.message },
    });
    throw error;
  }
}

export async function authorizeMdfe({
  companyId,
  mdfeId,
  userId,
  idempotencyKey,
  request,
  gateway = svrsMdfeGateway,
}) {
  const existing = await prisma.mdfeTransmissionAttempt.findUnique({
    where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
  });
  if (existing?.completedAt) return { idempotent: true, attempt: existing };
  if (existing) {
    throw new AppError(
      "Já existe uma transmissão em andamento para esta chave.",
      "MDFE_TRANSMISSION_IN_PROGRESS",
      409,
    );
  }
  let mdfe = await getMdfe(companyId, mdfeId);
  if (mdfe.status === "READY_TO_AUTHORIZE") {
    await signMdfe({ companyId, mdfeId, userId, request });
    mdfe = await getMdfe(companyId, mdfeId);
  }
  assertMdfeTransition(mdfe.status, "AUTHORIZING");
  const signed = mdfe.xmlArtifacts.find((artifact) => artifact.kind === "SIGNED");
  if (!signed) throw new AppError("XML assinado ausente.", "MDFE_SIGNED_XML_REQUIRED", 409);
  const attempt = await prisma.mdfeTransmissionAttempt.create({
    data: {
      companyId,
      mdfeDraftId: mdfe.id,
      idempotencyKey,
      operation: "AUTHORIZE",
      status: "PROCESSING",
      requestHash: sha256(signed.content),
    },
  });
  await prisma.mdfeDraft.update({ where: { id: mdfe.id }, data: { status: "AUTHORIZING" } });
  try {
    const secret = await loadCertificateSecret(companyId);
    const result = await gateway.authorize({
      environment: mdfe.environment,
      xml: signed.content,
      pfx: secret.pfx,
      passphrase: secret.passphrase,
    });
    const nextStatus = result.success ? "AUTHORIZED" : result.denied ? "DENIED" : "REJECTED";
    await prisma.$transaction(async (tx) => {
      let authorizedArtifact = null;
      if (result.success) {
        authorizedArtifact = await storeXmlArtifact({
          companyId,
          mdfeId: mdfe.id,
          kind: "AUTHORIZED",
          content: result.responseXml || signed.content,
          processVersion: mdfe.processVersion,
          client: tx,
        });
      }
      await tx.mdfeDraft.update({
        where: { id: mdfe.id },
        data: {
          status: nextStatus,
          statusCode: result.statusCode,
          statusReason: result.reason,
          protocol: result.protocol,
          authorizedAt: result.success ? new Date(result.receivedAt || Date.now()) : null,
        },
      });
      await tx.mdfeTransmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: result.success ? "SUCCESS" : "FAILED",
          statusCode: result.statusCode,
          responseReason: result.reason,
          responsePayload: result.raw,
          completedAt: new Date(),
        },
      });
      await tx.mdfeEvent.create({
        data: {
          companyId,
          mdfeDraftId: mdfe.id,
          type: result.success ? "AUTHORIZED" : nextStatus,
          title: result.success ? "MDF-e autorizado" : "Retorno da autorização",
          description: result.reason,
          previousStatus: "AUTHORIZING",
          newStatus: nextStatus,
          metadata: { statusCode: result.statusCode },
          protocol: result.protocol,
          statusCode: result.statusCode,
          responseReason: result.reason,
          xmlArtifactId: authorizedArtifact?.id || null,
          userId,
          requestId: request?.id || null,
        },
      });
    });
    return { ...result, status: nextStatus, attemptId: attempt.id };
  } catch (error) {
    await prisma.$transaction([
      prisma.mdfeDraft.update({
        where: { id: mdfe.id },
        data: {
          status: "ERROR",
          statusReason: "Falha de comunicação; reconciliação obrigatória antes de retransmitir.",
        },
      }),
      prisma.mdfeTransmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "UNKNOWN",
          responseReason: error.message,
          completedAt: new Date(),
        },
      }),
    ]);
    throw error;
  }
}

function simpleRequestXml(name, fields) {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: false,
  });
  return builder.build({
    [name]: {
      "@_xmlns": "http://www.portalfiscal.inf.br/mdfe",
      "@_versao": MDFE_LAYOUT_VERSION,
      ...fields,
    },
  });
}

export async function reconcileMdfe({
  companyId,
  mdfeId,
  userId,
  request,
  gateway = svrsMdfeGateway,
}) {
  const mdfe = await getMdfe(companyId, mdfeId);
  if (!mdfe.accessKey) throw new AppError("Chave do MDF-e ausente.", "MDFE_ACCESS_KEY_REQUIRED", 409);
  const secret = await loadCertificateSecret(companyId);
  const result = await gateway.consult({
    environment: mdfe.environment,
    xml: simpleRequestXml("consSitMDFe", {
      tpAmb: mdfe.environment === "production" ? "1" : "2",
      xServ: "CONSULTAR",
      chMDFe: mdfe.accessKey,
    }),
    pfx: secret.pfx,
    passphrase: secret.passphrase,
  });
  const nextStatus = result.success ? "AUTHORIZED" : mdfe.status;
  await prisma.$transaction([
    prisma.mdfeDraft.update({
      where: { id: mdfe.id },
      data: {
        status: nextStatus,
        statusCode: result.statusCode,
        statusReason: result.reason,
        protocol: result.protocol || mdfe.protocol,
        authorizedAt: result.success ? new Date(result.receivedAt || Date.now()) : mdfe.authorizedAt,
      },
    }),
    prisma.mdfeAuditLog.create({
      data: {
        companyId,
        mdfeDraftId: mdfe.id,
        action: "MDFE_RECONCILED",
        entityType: "MdfeDraft",
        entityId: mdfe.id,
        beforeData: { status: mdfe.status },
        afterData: { status: nextStatus, statusCode: result.statusCode },
        userId,
        ...requestMetadata(request),
      },
    }),
  ]);
  return { ...result, status: nextStatus };
}

function eventXml(mdfe, company, eventType, sequence, details) {
  return simpleRequestXml("eventoMDFe", {
    infEvento: {
      "@_Id": `ID${eventType}${mdfe.accessKey}${String(sequence).padStart(2, "0")}`,
      cOrgao: "91",
      tpAmb: mdfe.environment === "production" ? "1" : "2",
      CNPJ: normalizeTaxId(company.cnpj),
      chMDFe: mdfe.accessKey,
      dhEvento: new Date().toISOString(),
      tpEvento: eventType,
      nSeqEvento: sequence,
      detEvento: { "@_versaoEvento": MDFE_LAYOUT_VERSION, ...details },
    },
  });
}

async function sendMdfeEvent({
  companyId,
  mdfeId,
  userId,
  request,
  idempotencyKey,
  type,
  eventType,
  transitionalStatus,
  successStatus,
  details,
  gateway = svrsMdfeGateway,
}) {
  const existing = await prisma.mdfeEvent.findFirst({
    where: { mdfeDraftId: mdfeId, type, idempotencyKey },
  });
  if (existing) return { idempotent: true, event: existing };
  const company = await getCompanyOrThrow(companyId);
  const mdfe = await getMdfe(companyId, mdfeId);
  assertMdfeTransition(mdfe.status, transitionalStatus);
  const sequence =
    (await prisma.mdfeEvent.count({ where: { mdfeDraftId: mdfe.id, type } })) + 1;
  const material = await loadCertificateSigningMaterial(companyId);
  const unsignedXml = eventXml(mdfe, company, eventType, sequence, details);
  const signedXml = signMdfeEventXml(
    unsignedXml,
    material.privateKeyPem,
    material.certificatePem,
  );
  const xsd = await validateMdfeEventXmlWithXsd(signedXml);
  if (!xsd.valid) {
    throw new AppError(
      "O XML assinado do evento MDF-e nÃ£o passou na validaÃ§Ã£o XSD.",
      "MDFE_EVENT_XSD_VALIDATION_FAILED",
      422,
      xsd.errors.slice(0, 50),
    );
  }
  const artifact = await storeXmlArtifact({
    companyId,
    mdfeId: mdfe.id,
    kind: `EVENT_${type}`,
    content: signedXml,
    processVersion: mdfe.processVersion,
  });
  await prisma.mdfeDraft.update({
    where: { id: mdfe.id },
    data: { status: transitionalStatus },
  });
  try {
    const result = await gateway.sendEvent({
      environment: mdfe.environment,
      xml: signedXml,
      pfx: material.pfx,
      passphrase: material.passphrase,
    });
    const finalStatus = result.success ? successStatus : mdfe.status;
    const event = await prisma.$transaction(async (tx) => {
      await tx.mdfeDraft.update({
        where: { id: mdfe.id },
        data: {
          status: finalStatus,
          statusCode: result.statusCode,
          statusReason: result.reason,
        },
      });
      return tx.mdfeEvent.create({
        data: {
          companyId,
          mdfeDraftId: mdfe.id,
          type,
          title: type.replaceAll("_", " "),
          description: result.reason,
          previousStatus: mdfe.status,
          newStatus: finalStatus,
          metadata: details,
          userId,
          requestId: request?.id || null,
          idempotencyKey,
          eventSequence: sequence,
          protocol: result.protocol,
          statusCode: result.statusCode,
          responseReason: result.reason,
          xmlArtifactId: artifact.id,
        },
      });
    });
    return { ...result, status: finalStatus, event };
  } catch (error) {
    await prisma.mdfeDraft.update({
      where: { id: mdfe.id },
      data: { status: mdfe.status, statusReason: error.message },
    });
    throw error;
  }
}

export function cancelMdfe(input) {
  return sendMdfeEvent({
    ...input,
    type: "CANCELLATION",
    eventType: "110111",
    transitionalStatus: "CANCELLING",
    successStatus: "CANCELLED",
    details: {
      evCancMDFe: {
        descEvento: "Cancelamento",
        nProt: input.mdfe.protocol,
        xJust: input.reason,
      },
    },
  });
}

export function closeMdfe(input) {
  return sendMdfeEvent({
    ...input,
    type: "CLOSURE",
    eventType: "110112",
    transitionalStatus: "CLOSING",
    successStatus: "CLOSED",
    details: {
      evEncMDFe: {
        descEvento: "Encerramento",
        nProt: input.mdfe.protocol,
        dtEnc: input.payload.closedAt.toISOString().slice(0, 10),
        cUF: mdfeUfCode(input.payload.stateCode),
        cMun: input.payload.cityCode,
      },
    },
  });
}

export async function includeMdfeDriver(input) {
  if (!isValidCpf(input.payload.cpf)) {
    throw new AppError("CPF do condutor inválido.", "MDFE_DRIVER_CPF_INVALID", 422);
  }
  const result = await sendMdfeEvent({
    ...input,
    type: "DRIVER_INCLUDED",
    eventType: "110114",
    transitionalStatus: input.mdfe.status,
    successStatus: input.mdfe.status,
    details: {
      evIncCondutorMDFe: {
        descEvento: "Inclusao Condutor",
        condutor: { xNome: input.payload.name, CPF: input.payload.cpf },
      },
    },
  });
  if (result.success) {
    const sequence =
      (await prisma.mdfeDriver.count({ where: { mdfeDraftId: input.mdfeId } })) + 1;
    await prisma.mdfeDriver.create({
      data: {
        companyId: input.companyId,
        mdfeDraftId: input.mdfeId,
        cpf: input.payload.cpf,
        name: input.payload.name,
        sequence,
        isPrimary: false,
      },
    });
  }
  return result;
}

export async function getMdfeXml(companyId, mdfeId) {
  const mdfe = await getMdfe(companyId, mdfeId);
  const artifact = mdfe.xmlArtifacts[0];
  if (!artifact) throw new AppError("XML do MDF-e ainda não gerado.", "MDFE_XML_NOT_FOUND", 404);
  return artifact;
}

function pdfEscape(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[()\\]/g, (match) => `\\${match}`);
}

const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212",
  "112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131",
  "311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321",
  "112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121",
  "313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114",
  "122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212",
  "124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113",
  "114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112",
];

function code128Commands(value, originX = 40, originY = 485, maxWidth = 515, height = 48) {
  const text = String(value || "").toUpperCase();
  if (!text || !/^[\x20-\x7F]+$/.test(text)) return [];
  const compactNumeric = /^\d+$/.test(text) && text.length % 2 === 0;
  const start = compactNumeric ? 105 : 104;
  const values = compactNumeric
    ? text.match(/\d{2}/g).map(Number)
    : [...text].map((character) => character.charCodeAt(0) - 32);
  const checksum = (start + values.reduce((sum, item, index) => sum + item * (index + 1), 0)) % 103;
  const patterns = [CODE128_PATTERNS[start], ...values.map((item) => CODE128_PATTERNS[item]), CODE128_PATTERNS[checksum], CODE128_PATTERNS[106]];
  const modules = patterns.reduce((total, pattern) => total + [...pattern].reduce((sum, width) => sum + Number(width), 0), 0);
  const unit = maxWidth / modules;
  let x = originX;
  const commands = ["0 g"];
  for (const pattern of patterns) {
    [...pattern].forEach((width, index) => {
      const currentWidth = Number(width) * unit;
      if (index % 2 === 0) commands.push(`${x.toFixed(3)} ${originY} ${currentWidth.toFixed(3)} ${height} re f`);
      x += currentWidth;
    });
  }
  return commands;
}

function qrCodeCommands(value, originX = 445, originY = 665, size = 105) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const quiet = 4;
  const unit = size / (count + quiet * 2);
  const commands = ["1 g", `${originX} ${originY} ${size} ${size} re f`, "0 g"];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!qr.modules.get(row, column)) continue;
      const x = originX + (column + quiet) * unit;
      const y = originY + (count - row - 1 + quiet) * unit;
      commands.push(`${x.toFixed(3)} ${y.toFixed(3)} ${unit.toFixed(3)} ${unit.toFixed(3)} re f`);
    }
  }
  return commands;
}

export function buildDamdfePdf(lines, { barcodeValue, qrValue }) {
  const content = [
    "BT",
    "/F1 10 Tf",
    "40 800 Td",
    ...lines.flatMap((line, index) => [
      ...(index ? ["0 -18 Td"] : []),
      `(${pdfEscape(line)}) Tj`,
    ]),
    "ET",
    ...code128Commands(barcodeValue),
    ...qrCodeCommands(qrValue),
    "BT /F1 7 Tf 40 472 Td",
    `(${pdfEscape(barcodeValue || "CHAVE A GERAR")}) Tj ET`,
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function generateDamdfe(companyId, mdfeId) {
  const mdfe = await getMdfe(companyId, mdfeId);
  const authorized = ["AUTHORIZED", "IN_TRANSIT", "CLOSED", "CANCELLED"].includes(mdfe.status);
  const watermark = authorized
    ? mdfe.environment === "homologation"
      ? "AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
      : ""
    : "SEM VALOR FISCAL - NAO AUTORIZADO";
  return {
    filename: `damdfe-${mdfe.number || mdfe.id}.pdf`,
    contentType: "application/pdf",
    preview: !authorized,
    buffer: buildDamdfePdf([
      "DAMDFE - Documento Auxiliar do MDF-e",
      watermark,
      `Numero: ${mdfe.number || "-"}  Serie: ${mdfe.series}`,
      `Chave: ${mdfe.accessKey || "A GERAR"}`,
      `Protocolo: ${mdfe.protocol || "-"}`,
      `Origem/Destino: ${mdfe.loadingState || "-"} -> ${mdfe.unloadingState || "-"}`,
      `Veiculo: ${mdfe.vehicle?.plate || "-"}`,
      `Condutores: ${mdfe.drivers.map((driver) => driver.name).join(", ") || "-"}`,
      `Documentos: ${mdfe.fiscalDocuments.length}`,
      `Valor da carga: R$ ${(Number(mdfe.totalCargoCents || 0) / 100).toFixed(2)}`,
      `Peso total: ${Number(mdfe.totalWeightKg || 0).toFixed(3)} kg`,
      `Status: ${mdfe.status}`,
      "Codigo de barras Code 128 e QR Code para consulta abaixo.",
    ], {
      barcodeValue: mdfe.accessKey || "",
      qrValue: `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${mdfe.accessKey || ""}&tpAmb=${mdfe.environment === "production" ? "1" : "2"}`,
    }),
  };
}

export async function statusService({
  companyId,
  gateway = svrsMdfeGateway,
}) {
  const company = await getCompanyOrThrow(companyId);
  const secret = await loadCertificateSecret(companyId);
  return gateway.statusService({
    environment: toEnvironment(company),
    xml: simpleRequestXml("consStatServMDFe", {
      tpAmb: company.environment === "production" ? "1" : "2",
      xServ: "STATUS",
    }),
    pfx: secret.pfx,
    passphrase: secret.passphrase,
  });
}

export async function consultOpenMdfe({
  companyId,
  remote = false,
  gateway = svrsMdfeGateway,
}) {
  const local = await prisma.mdfeDraft.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: ["AUTHORIZED", "IN_TRANSIT", "ERROR"] },
    },
    include: { vehicle: true, drivers: { where: { isPrimary: true }, take: 1 } },
    orderBy: { emissionDate: "desc" },
  });
  if (!remote) return { local, remote: null };
  const company = await getCompanyOrThrow(companyId);
  const secret = await loadCertificateSecret(companyId);
  const remoteResult = await gateway.consultOpen({
    environment: toEnvironment(company),
    xml: simpleRequestXml("consMDFeNaoEnc", {
      tpAmb: company.environment === "production" ? "1" : "2",
      xServ: "CONSULTAR NÃO ENCERRADOS",
      CNPJ: normalizeTaxId(company.cnpj),
    }),
    pfx: secret.pfx,
    passphrase: secret.passphrase,
  });
  return { local, remote: remoteResult };
}

export async function getMdfeEvents(companyId, mdfeId) {
  await getMdfe(companyId, mdfeId);
  return prisma.mdfeEvent.findMany({
    where: { companyId, mdfeDraftId: mdfeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMdfeAudit(companyId, mdfeId) {
  await getMdfe(companyId, mdfeId);
  return prisma.mdfeAuditLog.findMany({
    where: { companyId, mdfeDraftId: mdfeId },
    orderBy: { createdAt: "desc" },
  });
}
