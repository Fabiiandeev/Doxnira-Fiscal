import { Router } from "express";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { syncQueue } from "../../config/queue.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { getCurrentCertificate, serializeCertificate } from "../../services/certificate-vault.service.js";
import { assertNsuWindow } from "../../services/nsu-control.service.js";
import { AppError } from "../../utils/app-error.js";
import { daysRemaining } from "../../utils/date.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

export async function getReadiness(company) {
  const certificate = await getCurrentCertificate(company.id);
  const serialized = serializeCertificate(certificate);
  const expired = serialized?.expired || false;
  const cnpjCompatible = certificate?.holderCnpj === company.cnpj;
  const certificateValid = Boolean(serialized?.valid && cnpjCompatible);
  let status = "READY_TO_SYNC_MOCK_MODE";
  let message = "Certificado válido. Sincronização simulada disponível.";
  if (!certificate) {
    status = "NO_CERTIFICATE";
    message = "Cadastre um certificado digital A1 para iniciar a sincronização.";
  } else if (expired) {
    status = "CERTIFICATE_EXPIRED";
    message = "O certificado digital está vencido.";
  } else if (!cnpjCompatible) {
    status = "CERTIFICATE_INVALID";
    message = "O CNPJ do certificado não corresponde à empresa.";
  } else if (!serialized.valid) {
    status = "CERTIFICATE_INVALID";
    message = "O certificado ainda não foi validado.";
  } else if (company.status !== "active") {
    status = "SYNC_BLOCKED";
    message = "Ative a empresa antes de sincronizar.";
  } else if (
    company.nfeNextAllowedSyncAt &&
    new Date(company.nfeNextAllowedSyncAt).getTime() > Date.now()
  ) {
    status = "SYNC_BLOCKED";
    message = "Aguarde a janela mínima para uma nova consulta por NSU.";
  } else if (env.SEFAZ_INTEGRATION_ENABLED) {
    if (
      env.SEFAZ_ENVIRONMENT === "production" &&
      !env.ALLOW_PRODUCTION_SEFAZ
    ) {
      status = "SYNC_BLOCKED";
      message = "Produção SEFAZ bloqueada por configuração.";
    } else {
      status = "READY_TO_SYNC";
      message = "Empresa pronta para sincronização real controlada.";
    }
  }

  const ready =
    certificateValid &&
    company.status === "active" &&
    !(
      env.SEFAZ_INTEGRATION_ENABLED &&
      env.SEFAZ_ENVIRONMENT === "production" &&
      !env.ALLOW_PRODUCTION_SEFAZ
    ) &&
    (!company.nfeNextAllowedSyncAt ||
      new Date(company.nfeNextAllowedSyncAt).getTime() <= Date.now());

  return {
    companyId: company.id,
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
            : serialized?.validatedAt
              ? "CERTIFICATE_INVALID"
              : "CERTIFICATE_UPLOADED",
    },
    sefaz: {
      integrationEnabled: env.SEFAZ_INTEGRATION_ENABLED,
      environment: env.SEFAZ_ENVIRONMENT,
      mode: env.SEFAZ_INTEGRATION_ENABLED ? "real" : "mock",
      productionAllowed: env.ALLOW_PRODUCTION_SEFAZ,
    },
    manifestation: {
      enabled: env.SEFAZ_MANIFESTATION_ENABLED,
      mode: env.SEFAZ_MANIFESTATION_ENABLED ? "real" : "mock",
      ready:
        env.SEFAZ_MANIFESTATION_ENABLED &&
        certificateValid &&
        !(
          env.SEFAZ_ENVIRONMENT === "production" &&
          !env.ALLOW_PRODUCTION_SEFAZ
        ),
      message: env.SEFAZ_MANIFESTATION_ENABLED
        ? "Manifestação real habilitada para ambiente controlado."
        : "Manifestação mockada ativa.",
    },
    cte: {
      enabled: env.CTE_INTEGRATION_ENABLED,
      mode: env.CTE_INTEGRATION_ENABLED ? "real" : "mock",
      ready:
        env.CTE_INTEGRATION_ENABLED &&
        certificateValid &&
        Boolean(
          env.SEFAZ_ENVIRONMENT === "production"
            ? env.CTE_DIST_DFE_PROD_URL
            : env.CTE_DIST_DFE_HOM_URL,
        ),
      message: env.CTE_INTEGRATION_ENABLED
        ? "Integração CT-e real condicionada ao endpoint configurado."
        : "Integração CT-e real desativada. Vínculo disponível via XML importado ou mock.",
    },
    sync: {
      ready,
      status,
      message,
      nextAllowedSyncAt: company.nfeNextAllowedSyncAt,
    },
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
    if (!readiness.certificate.exists) {
      throw new AppError(readiness.sync.message, "CERTIFICATE_REQUIRED", 409);
    }
    if (!readiness.certificate.valid) {
      throw new AppError(readiness.sync.message, readiness.sync.status, 409);
    }
    if (request.company.status !== "active") {
      throw new AppError(readiness.sync.message, "COMPANY_INACTIVE", 409);
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
            syncState:
              latest.status === "QUEUED"
                ? "SYNC_QUEUED"
                : latest.status === "RUNNING"
                  ? "SYNC_PROCESSING"
                  : latest.status === "SUCCESS"
                    ? "SYNC_SUCCESS"
                    : latest.status === "WAITING"
                      ? "SYNC_WAITING"
                      : latest.status === "WARNING"
                        ? "SYNC_BLOCKED"
                        : "SYNC_ERROR",
          }
        : null,
      company: {
        nfeLastNsu: request.company.nfeLastNsu,
        nfeMaxNsu: request.company.nfeMaxNsu,
        nextAllowedSyncAt: request.company.nfeNextAllowedSyncAt,
        lastSyncAt: request.company.lastSyncAt,
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
