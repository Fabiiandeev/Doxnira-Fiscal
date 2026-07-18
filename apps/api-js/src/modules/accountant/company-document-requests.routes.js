import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

const respondSchema = z.object({ message: z.string().trim().min(1).max(5_000) });
export const companyDocumentRequestsRouter = Router({ mergeParams: true });

function scoped(requestId, companyId) {
  return { id: requestId, companyId };
}

companyDocumentRequestsRouter.get("/document-requests", asyncHandler(async (request, response) => {
  const where = { companyId: request.company.id, ...(request.query.status ? { status: request.query.status } : {}) };
  const data = await prisma.accountantDocumentRequest.findMany({ where, orderBy: { createdAt: "desc" }, include: { fiscalDocument: { select: { id: true, accessKey: true, invoiceNumber: true } }, transportDocument: { select: { id: true, accessKey: true, number: true } } } });
  sendSuccess(response, data);
}));

companyDocumentRequestsRouter.get("/document-requests/:requestId", asyncHandler(async (request, response) => {
  const item = await prisma.accountantDocumentRequest.findFirst({ where: scoped(request.params.requestId, request.company.id), include: { events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { id: true, name: true } } } } } });
  if (!item) throw new AppError("Solicitação não encontrada.", "COMPANY_REQUEST_NOT_FOUND", 404);
  sendSuccess(response, item);
}));

companyDocumentRequestsRouter.post("/document-requests/:requestId/accept", asyncHandler(async (request, response) => {
  const item = await prisma.accountantDocumentRequest.findFirst({ where: scoped(request.params.requestId, request.company.id) });
  if (!item) throw new AppError("Solicitação não encontrada.", "COMPANY_REQUEST_NOT_FOUND", 404);
  if (item.status !== "OPEN") throw new AppError("Solicitação não pode ser assumida neste estado.", "COMPANY_REQUEST_TRANSITION_INVALID", 422);
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.accountantDocumentRequest.update({ where: { id: item.id }, data: { status: "IN_PROGRESS", assignedToUserId: request.user.id, acceptedAt: now } });
    await tx.accountantDocumentRequestEvent.create({ data: { requestId: item.id, officeId: item.officeId, companyId: item.companyId, actorUserId: request.user.id, actorRole: "COMPANY", eventType: "REQUEST_ACCEPTED", fromStatus: "OPEN", toStatus: "IN_PROGRESS" } });
    return changed;
  });
  sendSuccess(response, updated);
}));

companyDocumentRequestsRouter.post("/document-requests/:requestId/respond", asyncHandler(async (request, response) => {
  const payload = respondSchema.parse(request.body);
  const item = await prisma.accountantDocumentRequest.findFirst({ where: scoped(request.params.requestId, request.company.id) });
  if (!item) throw new AppError("Solicitação não encontrada.", "COMPANY_REQUEST_NOT_FOUND", 404);
  if (item.status !== "IN_PROGRESS" || item.assignedToUserId !== request.user.id) throw new AppError("Solicitação não está atribuída a este usuário.", "COMPANY_REQUEST_TRANSITION_INVALID", 422);
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.accountantDocumentRequest.update({ where: { id: item.id }, data: { status: "ANSWERED", responseMessage: payload.message, respondedAt: now, lastResponseAt: now, lastResponseByUserId: request.user.id } });
    await tx.accountantDocumentRequestEvent.create({ data: { requestId: item.id, officeId: item.officeId, companyId: item.companyId, actorUserId: request.user.id, actorRole: "COMPANY", eventType: "REQUEST_ANSWERED", fromStatus: "IN_PROGRESS", toStatus: "ANSWERED", message: payload.message } });
    return changed;
  });
  sendSuccess(response, updated);
}));
