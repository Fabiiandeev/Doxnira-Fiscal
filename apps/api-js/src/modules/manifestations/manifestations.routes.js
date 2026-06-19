import { randomUUID } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { forgetByPrefix } from "../../utils/cache.js";
import { writeAudit } from "../audit/audit.service.js";
import { findDocument } from "../documents/documents.service.js";
import { registerRealManifestation } from "../../services/manifestation-real.service.js";

const typeMap = {
  AWARE: "CIENCIA",
  CONFIRMED: "CONFIRMACAO",
  UNKNOWN: "DESCONHECIMENTO",
  NOT_PERFORMED: "OPERACAO_NAO_REALIZADA",
};

const manifestSchema = z
  .object({
    eventType: z.enum(["AWARE", "CONFIRMED", "UNKNOWN", "NOT_PERFORMED"]).optional(),
    type: z.enum(["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO", "OPERACAO_NAO_REALIZADA"]).optional(),
    justification: z.string().max(1000).optional().nullable(),
    mode: z.enum(["mock", "real"]).default("mock"),
    confirm: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (!value.eventType && !value.type) {
      context.addIssue({ code: "custom", path: ["type"], message: "Tipo obrigatório." });
    }
    const type = value.type || typeMap[value.eventType];
    if (
      type === "OPERACAO_NAO_REALIZADA" &&
      (!value.justification || value.justification.trim().length < 15)
    ) {
      context.addIssue({
        code: "custom",
        path: ["justification"],
        message: "A justificativa deve ter pelo menos 15 caracteres.",
      });
    }
  });

export const manifestationsRouter = Router({ mergeParams: true });

manifestationsRouter.post(
  "/",
  validate(manifestSchema),
  asyncHandler(async (request, response) => {
    const type = request.body.type || typeMap[request.body.eventType];
    const eventType =
      request.body.eventType ||
      Object.entries(typeMap).find(([, mapped]) => mapped === type)?.[0];
    const document = await findDocument(
      request.company.id,
      request.params.documentId,
    );
    if (request.body.mode === "real") {
      if (!env.SEFAZ_MANIFESTATION_ENABLED) {
        throw new AppError(
          "Manifestação real desativada por configuração.",
          "SEFAZ_MANIFESTATION_DISABLED",
          409,
        );
      }
      if (!request.body.confirm) {
        throw new AppError(
          "Confirmação explícita necessária para manifestação real.",
          "SEFAZ_MANIFESTATION_CONFIRMATION_REQUIRED",
          422,
        );
      }
      const result = await registerRealManifestation({
        company: request.company,
        document,
        userId: request.user.id,
        type,
        justification: request.body.justification,
      });
      sendSuccess(response, result, 201);
      return;
    }
    if (!document.accessKey) {
      throw new AppError("Documento sem chave de acesso.", "ACCESS_KEY_REQUIRED", 409);
    }
    const protocol = `MOCK-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const manifestation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.manifestation.create({
        data: {
          companyId: request.company.id,
          fiscalDocumentId: document.id,
          accessKey: document.accessKey,
          eventType,
          justification: request.body.justification?.trim() || null,
          protocol,
          status: "REGISTERED_MOCK",
          responseStorageKey: `mock/manifestations/${protocol}.xml`,
        },
      });
      await transaction.fiscalDocument.update({
        where: { id: document.id },
        data: { manifestationStatus: eventType },
      });
      return created;
    });
    forgetByPrefix(`dashboard:${request.company.id}:`);
    await writeAudit({
      request,
      action: "manifestation.registered",
      companyId: request.company.id,
      entityType: "FiscalDocument",
      entityId: document.id,
      metadata: { eventType, protocol },
    });
    sendSuccess(response, manifestation, 201);
  }),
);
