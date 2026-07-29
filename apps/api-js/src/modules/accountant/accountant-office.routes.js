import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { createAccountantRepository } from "./accountant.repository.js";
import { getAccountantDashboard } from "./accountant-dashboard.service.js";
import { getRiskRanking } from "./accountant-risk.service.js";
import { getValueReport } from "./accountant-value-report.service.js";
import { resolveOfficeScope, requireOfficeWrite } from "./accountant-office-access.js";
import { listSchema, officeParamsSchema, queueActionSchema, queueCreateSchema } from "./accountant.schemas.js";
import { mutateQueue } from "./accountant-queue.service.js";

export const accountantOfficeRouter = Router({ mergeParams: true });
const repository = createAccountantRepository(prisma);
const context = async (request) => {
  const { officeId } = officeParamsSchema.parse(request.params);
  const filters = listSchema.parse(request.query);
  return { filters, scope: await resolveOfficeScope(prisma, request.user.id, officeId, filters.companyId) };
};

accountantOfficeRouter.get("/dashboard", asyncHandler(async (req, res) => { const { scope, filters } = await context(req); sendSuccess(res, await getAccountantDashboard(prisma, scope, filters)); }));
accountantOfficeRouter.get("/risk-ranking", asyncHandler(async (req, res) => { const { scope } = await context(req); sendSuccess(res, { items: await getRiskRanking(prisma, scope) }); }));
accountantOfficeRouter.get("/value-report", asyncHandler(async (req, res) => { const { scope, filters } = await context(req); sendSuccess(res, await getValueReport(prisma, scope, filters)); }));
accountantOfficeRouter.get("/fiscal-queue", asyncHandler(async (req, res) => {
  const { scope, filters } = await context(req);
  const where = { officeId: scope.office.id, companyId: { in: scope.companyIds }, ...(filters.status ? { status: filters.status } : {}), ...(filters.severity ? { severity: filters.severity } : {}), ...(filters.responsibleId ? { responsibleUserId: filters.responsibleId } : {}) };
  const [items, total] = await repository.listQueue(where, filters.page, filters.pageSize);
  sendSuccess(res, { items, pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } });
}));
accountantOfficeRouter.post("/fiscal-queue", asyncHandler(async (req, res) => {
  const { scope } = await context(req); requireOfficeWrite(scope); const payload = queueCreateSchema.parse(req.body);
  if (!scope.companyIds.includes(payload.companyId)) return res.status(404).json({ error: { code: "ACCOUNTANT_SCOPE_NOT_FOUND", message: "Recurso não encontrado." } });
  const item = await repository.createQueue({ ...payload, officeId: scope.office.id, createdByUserId: req.user.id });
  await prisma.auditLog.create({ data: { companyId: item.companyId, userId: req.user.id, action: "ACCOUNTANT_QUEUE_CREATED", entityType: "AccountantFiscalQueueItem", entityId: item.id, metadata: { officeId: scope.office.id, origin: item.origin } } });
  sendSuccess(res, item, 201);
}));
for (const action of ["assign", "start", "request-information", "resolve", "dismiss", "reopen", "change-priority"]) {
  accountantOfficeRouter.post(`/fiscal-queue/:id/${action}`, asyncHandler(async (req, res) => {
    const { scope } = await context(req); requireOfficeWrite(scope);
    sendSuccess(res, await mutateQueue(prisma, repository, scope, req.user.id, req.params.id, action, queueActionSchema.parse(req.body || {})));
  }));
}
accountantOfficeRouter.get("/requests", asyncHandler(async (req, res) => {
  const { scope, filters } = await context(req); const where = { officeId: scope.office.id, companyId: { in: scope.companyIds }, ...(filters.status ? { status: filters.status } : {}) };
  const [items, total] = await Promise.all([prisma.accountantDocumentRequest.findMany({ where, include: { events: { orderBy: { createdAt: "asc" } }, company: { select: { legalName: true, tradeName: true } } }, orderBy: { updatedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }), prisma.accountantDocumentRequest.count({ where })]);
  sendSuccess(res, { items, pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } });
}));
accountantOfficeRouter.get("/documents", asyncHandler(async (req, res) => {
  const { scope, filters } = await context(req); const where = { companyId: { in: scope.companyIds }, ...(filters.search ? { OR: [{ accessKey: { contains: filters.search } }, { issuerName: { contains: filters.search, mode: "insensitive" } }] } : {}) };
  const [items, total] = await Promise.all([prisma.fiscalDocument.findMany({ where, select: { id: true, companyId: true, documentType: true, operationDirection: true, invoiceNumber: true, model: true, accessKey: true, status: true, issuerName: true, recipientName: true, emissionDate: true, totalAmount: true, isSummary: true }, orderBy: { emissionDate: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }), prisma.fiscalDocument.count({ where })]);
  sendSuccess(res, { items, pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } });
}));
