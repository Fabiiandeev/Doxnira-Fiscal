import { Router } from "express";

import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import {
  cancelMdfeSchema,
  closeMdfeSchema,
  eligibleNfesQuerySchema,
  includeDriverSchema,
  mdfeDraftCreateSchema,
  mdfeListQuerySchema,
  mdfeUpdateSchema,
  prepareMdfeFromNfesSchema,
  reprocessNfeAuthorizationSchema,
  saveAndAuthorizeMdfeSchema,
} from "./mdfe.schemas.js";
import {
  evaluateNfeEligibility,
  listEligibleNfes,
  prepareMdfesFromNfes,
  saveAndAuthorizeAutomaticMdfe,
} from "./mdfe-auto.service.js";
import {
  authorizeMdfe,
  cancelMdfe,
  closeMdfe,
  consultOpenMdfe,
  createMdfe,
  deleteMdfeDraft,
  duplicateMdfe,
  generateDamdfe,
  generateMdfeXml,
  getMdfe,
  getMdfeAudit,
  getMdfeEvents,
  getMdfeXml,
  includeMdfeDriver,
  listMdfe,
  reconcileMdfe,
  signMdfe,
  statusService,
  updateMdfe,
  validateMdfeDraft,
} from "./mdfe.service.js";
import { reprocessNfeAuthorizedEvents } from "../nfe/nfe-authorization-event.service.js";

export const mdfeRouter = Router({ mergeParams: true });

const ROLE_PERMISSIONS = Object.freeze({
  OWNER: ["*"],
  ADMIN: ["*"],
  PLATFORM_ADMIN: ["*"],
  PLATFORM_SUPER_ADMIN: ["*"],
  ACCOUNTANT: [
    "fiscal.mdfe.read",
    "fiscal.mdfe.download_xml",
    "fiscal.mdfe.download_damdfe",
  ],
  OPERATOR: [
    "fiscal.mdfe.read",
    "fiscal.mdfe.create",
    "fiscal.mdfe.update",
    "fiscal.mdfe.events",
    "fiscal.mdfe.download_xml",
    "fiscal.mdfe.download_damdfe",
  ],
  VIEWER: ["fiscal.mdfe.read"],
});

function requirePermission(permission) {
  return (request, _response, next) => {
    const permissions = ROLE_PERMISSIONS[request.user.role] || [];
    if (!permissions.includes("*") && !permissions.includes(permission)) {
      throw new AppError("Permissão insuficiente.", "FORBIDDEN", 403);
    }
    next();
  };
}

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message || "Dados inválidos.",
      "VALIDATION_ERROR",
      400,
      result.error.issues,
    );
  }
  return result.data;
}

function idempotencyKey(request) {
  const key = String(request.get("idempotency-key") || "").trim();
  if (!key || key.length > 120) {
    throw new AppError(
      "Idempotency-Key válida é obrigatória.",
      "IDEMPOTENCY_KEY_REQUIRED",
      400,
    );
  }
  return key;
}

mdfeRouter.get(
  "/",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await listMdfe(request.company.id, parse(mdfeListQuerySchema, request.query)),
    );
  }),
);

mdfeRouter.post(
  "/",
  requirePermission("fiscal.mdfe.create"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await createMdfe({
        companyId: request.company.id,
        userId: request.user.id,
        payload: parse(mdfeDraftCreateSchema, request.body),
        request,
      }),
      201,
    );
  }),
);

mdfeRouter.get(
  "/open",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await consultOpenMdfe({
        companyId: request.company.id,
        remote: String(request.query.remote || "false") === "true",
      }),
    );
  }),
);

mdfeRouter.get(
  "/status-service",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await statusService({ companyId: request.company.id }));
  }),
);

mdfeRouter.get(
  "/eligible-nfes",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await listEligibleNfes(
        request.company.id,
        parse(eligibleNfesQuerySchema, request.query),
      ),
    );
  }),
);

mdfeRouter.post(
  "/eligible-nfes/:nfeId/evaluate",
  requirePermission("fiscal.mdfe.create"),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await evaluateNfeEligibility({
      companyId: request.company.id,
      nfeDocumentId: request.params.nfeId,
    }));
  }),
);

mdfeRouter.post(
  "/eligibility/reprocess",
  requirePermission("fiscal.mdfe.create"),
  asyncHandler(async (request, response) => {
    const payload = parse(reprocessNfeAuthorizationSchema, request.body || {});
    sendSuccess(response, await reprocessNfeAuthorizedEvents({
      companyId: request.company.id,
      ...payload,
    }));
  }),
);

mdfeRouter.post(
  "/prepare-from-nfes",
  requirePermission("fiscal.mdfe.create"),
  asyncHandler(async (request, response) => {
    const payload = parse(prepareMdfeFromNfesSchema, request.body);
    sendSuccess(response, await prepareMdfesFromNfes({
      companyId: request.company.id,
      userId: request.user.id,
      ...payload,
      idempotencyKey: idempotencyKey(request),
      request,
    }), 201);
  }),
);

mdfeRouter.get(
  "/:mdfeId",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await getMdfe(request.company.id, request.params.mdfeId));
  }),
);

mdfeRouter.post(
  "/:mdfeId/save-and-authorize",
  requirePermission("fiscal.mdfe.authorize"),
  asyncHandler(async (request, response) => {
    const payload = parse(saveAndAuthorizeMdfeSchema, request.body || {});
    sendSuccess(response, await saveAndAuthorizeAutomaticMdfe({
      companyId: request.company.id,
      mdfeId: request.params.mdfeId,
      userId: request.user.id,
      idempotencyKey: idempotencyKey(request),
      confirmRoute: payload.confirmRoute,
      confirmPredominantProduct: payload.confirmPredominantProduct,
      request,
    }));
  }),
);

async function updateHandler(request, response) {
  sendSuccess(
    response,
    await updateMdfe({
      companyId: request.company.id,
      mdfeId: request.params.mdfeId,
      userId: request.user.id,
      payload: parse(mdfeUpdateSchema, request.body),
      request,
    }),
  );
}

mdfeRouter.patch(
  "/:mdfeId",
  requirePermission("fiscal.mdfe.update"),
  asyncHandler(updateHandler),
);
mdfeRouter.put(
  "/:mdfeId",
  requirePermission("fiscal.mdfe.update"),
  asyncHandler(updateHandler),
);

mdfeRouter.delete(
  "/:mdfeId",
  requirePermission("fiscal.mdfe.update"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await deleteMdfeDraft({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/duplicate",
  requirePermission("fiscal.mdfe.create"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await duplicateMdfe({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
      201,
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/validate",
  requirePermission("fiscal.mdfe.update"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await validateMdfeDraft({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/xml/generate",
  requirePermission("fiscal.mdfe.update"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await generateMdfeXml({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/sign",
  requirePermission("fiscal.mdfe.authorize"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await signMdfe({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/authorize",
  requirePermission("fiscal.mdfe.authorize"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await authorizeMdfe({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        idempotencyKey: idempotencyKey(request),
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/reconcile",
  requirePermission("fiscal.mdfe.authorize"),
  asyncHandler(async (request, response) => {
    sendSuccess(
      response,
      await reconcileMdfe({
        companyId: request.company.id,
        mdfeId: request.params.mdfeId,
        userId: request.user.id,
        request,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/cancel",
  requirePermission("fiscal.mdfe.cancel"),
  asyncHandler(async (request, response) => {
    const mdfe = await getMdfe(request.company.id, request.params.mdfeId);
    const payload = parse(cancelMdfeSchema, request.body);
    sendSuccess(
      response,
      await cancelMdfe({
        companyId: request.company.id,
        mdfeId: mdfe.id,
        userId: request.user.id,
        request,
        idempotencyKey: idempotencyKey(request),
        reason: payload.reason,
        mdfe,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/close",
  requirePermission("fiscal.mdfe.close"),
  asyncHandler(async (request, response) => {
    const mdfe = await getMdfe(request.company.id, request.params.mdfeId);
    sendSuccess(
      response,
      await closeMdfe({
        companyId: request.company.id,
        mdfeId: mdfe.id,
        userId: request.user.id,
        request,
        idempotencyKey: idempotencyKey(request),
        payload: parse(closeMdfeSchema, request.body),
        mdfe,
      }),
    );
  }),
);

mdfeRouter.post(
  "/:mdfeId/events/include-driver",
  requirePermission("fiscal.mdfe.events"),
  asyncHandler(async (request, response) => {
    const mdfe = await getMdfe(request.company.id, request.params.mdfeId);
    sendSuccess(
      response,
      await includeMdfeDriver({
        companyId: request.company.id,
        mdfeId: mdfe.id,
        userId: request.user.id,
        request,
        idempotencyKey: idempotencyKey(request),
        payload: parse(includeDriverSchema, request.body),
        mdfe,
      }),
    );
  }),
);

mdfeRouter.get(
  "/:mdfeId/xml",
  requirePermission("fiscal.mdfe.download_xml"),
  asyncHandler(async (request, response) => {
    const artifact = await getMdfeXml(request.company.id, request.params.mdfeId);
    response
      .status(200)
      .type("application/xml")
      .set("content-disposition", `attachment; filename="mdfe-${request.params.mdfeId}.xml"`)
      .send(artifact.content);
  }),
);

mdfeRouter.get(
  "/:mdfeId/damdfe",
  requirePermission("fiscal.mdfe.download_damdfe"),
  asyncHandler(async (request, response) => {
    const artifact = await generateDamdfe(request.company.id, request.params.mdfeId);
    response
      .status(200)
      .type(artifact.contentType)
      .set("content-disposition", `inline; filename="${artifact.filename}"`)
      .set("x-damdfe-preview", artifact.preview ? "true" : "false")
      .send(artifact.buffer);
  }),
);

mdfeRouter.get(
  "/:mdfeId/events",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await getMdfeEvents(request.company.id, request.params.mdfeId));
  }),
);

mdfeRouter.get(
  "/:mdfeId/audit",
  requirePermission("fiscal.mdfe.read"),
  asyncHandler(async (request, response) => {
    sendSuccess(response, await getMdfeAudit(request.company.id, request.params.mdfeId));
  }),
);
