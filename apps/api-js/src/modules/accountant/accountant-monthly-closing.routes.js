import { Router } from "express";
import { z } from "zod";

import { hasAccountantPermission } from "../../middlewares/accountant-company-access.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { approveMonthlyClosing, calculateMonthlyClosing, getMonthlyClosing, listMonthlyClosings, reopenMonthlyClosing } from "../../services/monthly-tax-closing.service.js";

const periodSchema = z.object({ periodYear: z.coerce.number().int().min(2006).max(2100), periodMonth: z.coerce.number().int().min(1).max(12) });
const noteSchema = z.object({ note: z.string().trim().min(1).max(5_000).optional(), reason: z.string().trim().min(1).max(5_000).optional() });

function requireClosingPermission(request, action) {
  const permission = `fiscal.closing.${action}`;
  // Existing FULL roles retain compatibility; restricted users need the explicit grant.
  if (!hasAccountantPermission(request, permission)) throw new AppError("Permissão de fechamento fiscal insuficiente.", "ACCOUNTANT_PERMISSION_FORBIDDEN", 403);
}

async function audit(request, action, closing) {
  await writeAudit({ request, action: `accountant.monthly_closing.${action}`, companyId: request.company.id, entityType: "MonthlyTaxClosing", entityId: closing.id, metadata: { officeId: request.accountantContext.office.id, periodYear: closing.periodYear, periodMonth: closing.periodMonth, status: closing.status } });
}

export const accountantMonthlyClosingRouter = Router({ mergeParams: true });

accountantMonthlyClosingRouter.get("/monthly-tax-closings", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "read");
  sendSuccess(response, await listMonthlyClosings(request.company.id, request.query));
}));

accountantMonthlyClosingRouter.post("/monthly-tax-closings", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "create");
  const body = periodSchema.parse(request.body);
  const closing = await calculateMonthlyClosing(request.company.id, body.periodYear, body.periodMonth, { userId: request.user.id, officeId: request.accountantContext.office.id });
  await audit(request, "created", closing);
  sendSuccess(response, closing, 201);
}));

accountantMonthlyClosingRouter.get("/monthly-tax-closings/:closingId", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "read");
  sendSuccess(response, await getMonthlyClosing(request.company.id, request.params.closingId));
}));

accountantMonthlyClosingRouter.post("/monthly-tax-closings/:closingId/recalculate", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "recalculate");
  const current = await getMonthlyClosing(request.company.id, request.params.closingId);
  const closing = await calculateMonthlyClosing(request.company.id, current.periodYear, current.periodMonth, { userId: request.user.id, officeId: request.accountantContext.office.id });
  await audit(request, "recalculated", closing);
  sendSuccess(response, closing);
}));

accountantMonthlyClosingRouter.post("/monthly-tax-closings/:closingId/approve", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "approve");
  const body = noteSchema.parse(request.body);
  const closing = await approveMonthlyClosing(request.company.id, request.params.closingId, { userId: request.user.id, note: body.note });
  await audit(request, "approved", closing);
  sendSuccess(response, closing);
}));

accountantMonthlyClosingRouter.post("/monthly-tax-closings/:closingId/reopen", asyncHandler(async (request, response) => {
  requireClosingPermission(request, "reopen");
  const body = noteSchema.parse(request.body);
  const closing = await reopenMonthlyClosing(request.company.id, request.params.closingId, { userId: request.user.id, reason: body.reason });
  await audit(request, "reopened", closing);
  sendSuccess(response, closing);
}));
