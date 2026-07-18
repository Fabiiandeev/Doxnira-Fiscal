import { Router } from "express";
import { z } from "zod";

import { hasAccountantPermission } from "../../middlewares/accountant-company-access.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { generateFiscalExport, getFiscalExport, listFiscalExports, validateFiscalExport } from "../../services/fiscal-export.service.js";

const router = Router({ mergeParams: true });
const generation = z.object({ preparationId: z.string().uuid(), type: z.enum(["SPED_FISCAL", "SINTEGRA"]) });
const list = z.object({ preparationId: z.string().uuid().optional(), type: z.enum(["SPED_FISCAL", "SINTEGRA"]).optional(), page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
function allow(request, action) { if (!hasAccountantPermission(request, `fiscal.export.${action}`)) throw new AppError("Permissão de exportação fiscal insuficiente.", "ACCOUNTANT_PERMISSION_FORBIDDEN", 403); }
function audit(request, action, metadata) { return writeAudit({ request, action: `accountant.fiscal_export.${action}`, companyId: request.company.id, entityType: "FiscalExport", entityId: metadata.exportId || metadata.preparationId, metadata: { officeId: request.accountantContext.office.id, ...metadata } }); }

router.get("/fiscal-exports", asyncHandler(async (request, response) => { allow(request, "read"); sendSuccess(response, await listFiscalExports(request.company.id, request.accountantContext.office.id, list.parse(request.query))); }));
router.post("/fiscal-exports/validate", asyncHandler(async (request, response) => { allow(request, "generate"); const body = generation.pick({ preparationId: true }).parse(request.body); try { const value = await validateFiscalExport(request.company.id, request.accountantContext.office.id, body.preparationId); await audit(request, "validated", value); sendSuccess(response, value); } catch (error) { await audit(request, "blocked", { preparationId: body.preparationId, reason: error.code || "FISCAL_EXPORT_VALIDATION_FAILED" }); throw error; } }));
router.post("/fiscal-exports", asyncHandler(async (request, response) => { allow(request, "generate"); const body = generation.parse(request.body); try { const value = await generateFiscalExport(request.company.id, request.accountantContext.office.id, body.preparationId, body.type, { userId: request.user.id }); await audit(request, "generated", { exportId: value.id, preparationId: value.preparationId, closingId: value.closingId, type: value.type, hash: value.contentHash, status: value.status }); sendSuccess(response, value, 201); } catch (error) { await audit(request, "blocked", { preparationId: body.preparationId, type: body.type, reason: error.code || "FISCAL_EXPORT_GENERATION_FAILED" }); throw error; } }));
router.get("/fiscal-exports/:exportId", asyncHandler(async (request, response) => { allow(request, "read"); sendSuccess(response, await getFiscalExport(request.company.id, request.accountantContext.office.id, request.params.exportId)); }));
router.get("/fiscal-exports/:exportId/download", asyncHandler(async (request, response) => { allow(request, "download"); const value = await getFiscalExport(request.company.id, request.accountantContext.office.id, request.params.exportId, true); await audit(request, "downloaded", { exportId: value.id, preparationId: value.preparationId, closingId: value.closingId, type: value.type, hash: value.contentHash, status: value.status }); response.set({ "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${value.fileName}"`, "x-content-type-options": "nosniff" }); response.send(value.content); }));

export { router as fiscalExportRouter };
