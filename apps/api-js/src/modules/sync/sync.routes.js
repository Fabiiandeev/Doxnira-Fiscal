import { Router } from "express";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { syncQueue } from "../../config/queue.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { getCurrentCertificate, serializeCertificate } from "../../services/certificate-vault.service.js";
import { assertNsuWindow } from "../../services/nsu-control.service.js";
import { AppError } from "../../utils/app-error.js";
import { normalizeCnpj } from "../../utils/cnpj.js";
import { daysRemaining } from "../../utils/date.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

export async function getReadiness(company) {
  const certificate = await getCurrentCertificate(company.id);
  const serialized = serializeCertificate(certificate);
  const expired = serialized?.expired || false;
  const cnpjCompatible =
    Boolean(certificate?.holderCnpj) &&
    normalizeCnpj(certificate.holderCnpj) === normalizeCnpj(company.cnpj);
  const certificateValid = Boolean(serialized?.valid && cnpjCompatible);
  const actions = [];

  if (!certificate) {
    actions.push({ code: "CERTIFICATE_REQUIRED", target: "certificate" });
  } else if (expired) {
    actions.push({ code: "CERTIFICATE_EXPIRED", target: "certificate" });
  } else if (!cnpjCompatible) {
    actions.push({ code: "CERTIFICATE_CNPJ_MISMATCH", target: "certificate" });
  } else if (!serialized.valid) {
    actions.push({ code: "CERTIFICATE_INVALID", target: "certificate" });
  }

  let status = "REAL_INTEGRATION_DISABLED";
  let message = "Sincronização real com a SEFAZ está desativada (SEFAZ_INTEGRATION_ENABLED=false).";
  if (!env.SEFAZ_INTEGRATION_ENABLED) {
    actions.push({ code: "REAL_INTEGRATION_DISABLED", target: "company" });
  } else if (company.environment === "production" && !env.ALLOW_PRODUCTION_SEFAZ) {
    status = "SYNC_BLOCKED";
    message =
      "Empresa configurada para produção, mas ALLOW_PRODUCTION_SEFAZ está desativado.";
    actions.push({ code: "PRODUCTION_SEFAZ_BLOCKED", target: "company" });
  } else if (!certificate) {
    status = "NO_CERTIFICATE";
    message = "Cadastre um certificado digital A1 para iniciar a sincronização.";
  } else if (expired) {
    status = "CERTIFICATE_EXPIRED";
    message = "O certificado digital está vencido.";
  } else if (!cnpjCompatible) {
    status = "CERTIFICATE_CNPJ_MISMATCH";
    message = "O CNPJ do certificado não corresponde ao CNPJ da empresa.";
  } else if (!serialized.valid) {
    status = "CERTIFICATE_INVALID";
    message = "O certificado ainda não foi validado.";
  } else if (company.status !== "active") {
    status = "SYNC_BLOCKED";
    message = "Ative a empresa antes de sincronizar.";
    actions.push({ code: "COMPANY_INACTIVE", target: "company" });
  } else if (
    company.nfeNextAllowedSyncAt &&
    new Date(company.nfeNextAllowedSyncAt).getTime() > Date.now()
  ) {
    status = "SYNC_BLOCKED";
    message = "Aguarde a janela mínima para uma nova consulta por NSU.";
    actions.push({ code: "SYNC_RATE_LIMITED", target: "sync" });
  } else {
    status = "READY_TO_SYNC";
    message = "Empresa pronta para sincronização real controlada.";
  }

  const ready =
    env.SEFAZ_INTEGRATION_ENABLED &&
    certificateValid &&
    company.status === "active" &&
    !(
      company.environment === "production" &&
      !env.ALLOW_PRODUCTION_SEFAZ
    ) &&
    (!company.nfeNextAllowedSyncAt ||
      new Date(company.nfeNextAllowedSyncAt).getTime() <= Date.now());

  return {
    companyId: company.id,
    company: {
      environment: company.environment,
      uf: company.uf,
    },
    certificate: {
      exists: Boolean(certificate),
      valid: certificateValid,
      expired,
      cnpjCompatible,
      daysRemaining: certificate ? daysRemaining(certificate.validUntil) : null,
      status: !certificate
        ? "NO_CERTIFICATE"
        : expired
          ? "CERTIFICATE_EXPIRED"
          : certificateValid
            ? "CERTIFICATE_VALID"
            : !cnpjCompatible
              ? "CERTIFICATE_CNPJ_MISMATCH"
            : serialized?.validatedAt
              ? "CERTIFICATE_INVALID"
              : "CERTIFICATE_UPLOADED",
    },
    sefaz: {
      integrationEnabled: env.SEFAZ_INTEGRATION_ENABLED,
      environment: company.environment,
      mode: "real",
      productionAllowed: env.ALLOW_PRODUCTION_SEFAZ,
    },
    manifestation: {
      enabled: env.SEFAZ_MANIFESTATION_ENABLED,
      mode: env.SEFAZ_MANIFESTATION_ENABLED ? "real" : "real",
      ready:
        env.SEFAZ_MANIFESTATION_ENABLED &&
        certificateValid &&
        !(
          company.environment === "production" &&
          !env.ALLOW_PRODUCTION_SEFAZ
        ),
      message: env.SEFAZ_MANIFESTATION_ENABLED
        ? "Manifestação real habilitada para ambiente controlado."
        : "Manifestação real desativada por configuração.",
    },
    cte: {
      enabled: env.CTE_INTEGRATION_ENABLED,
      mode: env.CTE_INTEGRATION_ENABLED ? "real" : "real",
      ready:
        env.CTE_INTEGRATION_ENABLED &&
        certificateValid &&
        Boolean(
          company.environment === "production"
            ? env.CTE_DIST_DFE_PROD_URL
            : env.CTE_DIST_DFE_HOM_URL,
        ),
      message: env.CTE_INTEGRATION_ENABLED
        ? "Integração CT-e real condicionada ao endpoint configurado."
        : "Integração CT-e real desativada. Vínculo disponível via XML importado.",
    },
    sync: {
      ready,
      status,
      message,
      nextAllowedSyncAt: company.nfeNextAllowedSyncAt,
    },
    actions,
  };
}

export const syncRouter = Router({ mergeParams: true });

syncRouter.get("/readiness", asyncHandler(async (request, response) => {
  sendSuccess(response, await getReadiness(request.company));
}));

syncRouter.post(
  "/nfe",
  rateLimit({ key: "sync", max: 10, windowMs: 60 * 60_000 }),
  asyncHandler(async (request, response) => {
    const readiness = await getReadiness(request.company);
    if (!readiness.sync.ready) {
      throw new AppError(readiness.sync.message, readiness.sync.status, 409, readiness.actions);
    }
    assertNsuWindow(request.company);

    const active = await prisma.syncLog.findFirst({
      where: { companyId: request.company.id, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true, jobId: true },
    });
    if (active) {
      throw new AppError(
        "Já existe uma sincronização em andamento.",
        "SYNC_ALREADY_RUNNING",
        409,
        [active],
      );
    }

    const syncLog = await prisma.syncLog.create({
      data: {
        companyId: request.company.id,
        service: "NFeDistribuicaoDFe",
        requestType: "distNSU",
        requestNsu: request.company.nfeLastNsu,
        mode: readiness.sefaz.mode,
        environment: request.company.environment,
        status: "QUEUED",
        startedAt: new Date(),
      },
    });

    try {
      const job = await syncQueue.add(
        "sync-company",
        {
          companyId: request.company.id,
          syncLogId: syncLog.id,
          scenario: ["137", "138", "656"].includes(request.body?.scenario)
            ? request.body.scenario
            : "138",
        },
        { jobId: `company-${request.company.id}-${syncLog.id}` },
      );
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { jobId: String(job.id) },
      });
      await writeAudit({
        request,
        action: "sync.requested",
        companyId: request.company.id,
        entityType: "SyncLog",
        entityId: syncLog.id,
        metadata: { mode: readiness.sefaz.mode },
      });
      sendSuccess(
        response,
        {
          id: syncLog.id,
          jobId: job.id,
          status: "SYNC_QUEUED",
          mode: readiness.sefaz.mode,
          message:
            readiness.sefaz.mode === "mock"
              ? "Sincronização simulada iniciada."
              : "Sincronização fiscal iniciada.",
        },
        202,
      );
    } catch (error) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "ERROR",
          errorMessage: "Fila de sincronização indisponível.",
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }),
);

syncRouter.get(
  "/status",
  asyncHandler(async (request, response) => {
    const latest = await prisma.syncLog.findFirst({
      where: { companyId: request.company.id },
      select: {
        id: true,
        jobId: true,
        status: true,
        cstat: true,
        xmotivo: true,
        documentsCount: true,
        documentsReceived: true,
        documentsSaved: true,
        mode: true,
        environment: true,
        requestNsu: true,
        responseUltNsu: true,
        responseMaxNsu: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
      },
      orderBy: { startedAt: "desc" },
    });
    sendSuccess(response, {
      latest: latest
        ? {
            ...latest,
            syncState: (() => {
              if (latest.status === "QUEUED") return "SYNC_QUEUED";
              if (latest.status === "RUNNING") return "SYNC_PROCESSING";
              if (latest.status === "SUCCESS") return "SYNC_SUCCESS";
              // prefer cStat-based hints when available
              if (latest.cstat === 137) return "SYNC_NO_DOCUMENTS";
              if (latest.cstat === 656) return "SYNC_BLOCKED_TEMPORARY";
              if (latest.status === "NO_DOCUMENTS") return "SYNC_NO_DOCUMENTS";
              if (latest.status === "WARNING") return "SYNC_WARNING";
              return "SYNC_ERROR";
            })(),
          }
        : null,
      company: {
        nfeLastNsu: request.company.nfeLastNsu,
        nfeMaxNsu: request.company.nfeMaxNsu,
        nextAllowedSyncAt: request.company.nfeNextAllowedSyncAt,
        lastSyncAt: request.company.lastSyncAt,
        environment: request.company.environment,
        uf: request.company.uf,
      },
    });
  }),
);

syncRouter.get(
  "/logs",
  asyncHandler(async (request, response) => {
    const { page, pageSize, skip, take } = getPagination(request.query, 10);
    const where = { companyId: request.company.id };
    const [data, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        select: {
          id: true,
          service: true,
          requestType: true,
          requestNsu: true,
          responseUltNsu: true,
          responseMaxNsu: true,
          cstat: true,
          xmotivo: true,
          documentsCount: true,
          documentsReceived: true,
          documentsSaved: true,
          mode: true,
          environment: true,
          status: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
        },
        orderBy: { startedAt: "desc" },
        skip,
        take,
      }),
      prisma.syncLog.count({ where }),
    ]);
    sendSuccess(response, { data, pagination: paginationMeta(page, pageSize, total) });
  }),
);
