import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { hasAccountantPermission } from "../../middlewares/accountant-company-access.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { writeAudit } from "../audit/audit.service.js";
import { findDocument, searchDocuments } from "../documents/documents.service.js";
import { canDownloadAccountantXml, getAccountantFiscalDocumentDetail } from "./accountant-document-detail.service.js";
import { reconcileTransportDocumentLinks } from "../../services/document-link.service.js";

const reviewSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "WITH_ISSUES", "IGNORED", "REOPENED"]),
  note: z.string().max(5_000).optional(),
  reopenReason: z.string().max(2_000).optional(),
  category: z.enum(["CFOP", "NCM", "CEST", "CST", "CSOSN", "XML", "CTE_LINK", "TOTALS", "PARTICIPANT", "CANCELLATION", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
const noteSchema = z.object({ content: z.string().trim().min(1).max(5_000) });
const tagSchema = z.object({ name: z.string().trim().min(1).max(80), color: z.string().trim().max(20).optional() });
const requestSchema = z.object({ type: z.string().trim().min(1).max(60), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), description: z.string().trim().max(5_000).optional() });

function requirePermission(request, permission) {
  if (!hasAccountantPermission(request, permission)) {
    throw new AppError("Permissão contábil insuficiente.", "ACCOUNTANT_PERMISSION_FORBIDDEN", 403);
  }
}

function normalizedTag(name) { return name.trim().toLocaleLowerCase("pt-BR"); }
const reviewTransitions = {
  PENDING: ["REVIEWED", "WITH_ISSUES", "IGNORED"], REVIEWED: ["REOPENED"],
  WITH_ISSUES: ["REVIEWED", "REOPENED"], IGNORED: ["REOPENED"], REOPENED: ["REVIEWED", "WITH_ISSUES", "IGNORED"],
};
function validateReviewTransition(previous, payload) {
  if (previous && !reviewTransitions[previous.status]?.includes(payload.status)) throw new AppError("Transição de conferência inválida.", "ACCOUNTANT_REVIEW_TRANSITION_INVALID", 422);
  if (["WITH_ISSUES", "IGNORED", "REOPENED"].includes(payload.status) && !((payload.status === "REOPENED" ? payload.reopenReason : payload.note)?.trim())) throw new AppError("Justificativa é obrigatória para esta ação.", "ACCOUNTANT_REVIEW_JUSTIFICATION_REQUIRED", 422);
  if (payload.status === "WITH_ISSUES" && (!payload.category || !payload.priority)) throw new AppError("Categoria e prioridade são obrigatórias para pendências.", "ACCOUNTANT_REVIEW_ISSUE_DETAILS_REQUIRED", 422);
}

function reviewData(context, documentId, body) {
  const now = new Date();
  return {
    officeId: context.office.id,
    companyId: context.company.id,
    fiscalDocumentId: documentId,
    userId: context.user.id,
    status: body.status,
    note: body.note ?? null,
    reviewedAt: body.status === "REVIEWED" || body.status === "WITH_ISSUES" || body.status === "IGNORED" ? now : null,
    reopenedAt: body.status === "REOPENED" ? now : null,
    reopenReason: body.status === "REOPENED" ? body.reopenReason ?? null : null,
  };
}

async function fiscalSummary(companyId, query, officeId) {
  const start = query.startDate ? new Date(`${query.startDate}T00:00:00`) : undefined;
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999`) : undefined;
  const where = { companyId, ...(start || end ? { emissionDate: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) };
  const [documents, cancelled, alerts, reviews] = await Promise.all([
    prisma.fiscalDocument.aggregate({
      where,
      _count: { id: true },
      _sum: { totalAmount: true, icmsAmount: true, ipiAmount: true, pisAmount: true, cofinsAmount: true },
    }),
    prisma.fiscalDocument.count({ where: { ...where, isCancelled: true } }),
    prisma.alert.count({ where: { companyId, status: "open", ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) } }),
    prisma.accountantDocumentReview.count({ where: { companyId, officeId, status: { not: "REVIEWED" } } }),
  ]);
  const grouped = await prisma.fiscalDocument.groupBy({
    by: ["documentType", "operationDirection", "isSummary"], where,
    _count: { id: true }, _sum: { totalAmount: true, freightAmount: true },
  });
  const totalFor = (predicate) => grouped.filter(predicate).reduce((sum, entry) => sum + Number(entry._sum.totalAmount || 0), 0);
  return {
    totalDocuments: documents._count.id,
    inboundDocuments: grouped.filter((entry) => entry.operationDirection === "INBOUND").reduce((sum, entry) => sum + entry._count.id, 0),
    outboundDocuments: grouped.filter((entry) => entry.operationDirection === "OUTBOUND").reduce((sum, entry) => sum + entry._count.id, 0),
    cteDocuments: 0,
    cancelledDocuments: cancelled,
    documentsWithAlerts: alerts,
    unreviewedDocuments: reviews,
    documentsWithoutXml: grouped.filter((entry) => entry.isSummary).reduce((sum, entry) => sum + entry._count.id, 0),
    inboundTotal: totalFor((entry) => entry.operationDirection === "INBOUND"),
    outboundTotal: totalFor((entry) => entry.operationDirection === "OUTBOUND"),
    freightTotal: grouped.reduce((sum, entry) => sum + Number(entry._sum.freightAmount || 0), 0),
    icmsTotal: Number(documents._sum.icmsAmount || 0), ipiTotal: Number(documents._sum.ipiAmount || 0),
    pisTotal: Number(documents._sum.pisAmount || 0), cofinsTotal: Number(documents._sum.cofinsAmount || 0),
  };
}

export const accountantDocumentsRouter = Router({ mergeParams: true });

accountantDocumentsRouter.get("/fiscal-documents/summary", asyncHandler(async (request, response) => {
  sendSuccess(response, await fiscalSummary(request.company.id, request.query, request.accountantContext.office.id));
}));

accountantDocumentsRouter.get("/fiscal-documents", asyncHandler(async (request, response) => {
  const result = await searchDocuments(request.company.id, { ...request.query, accountantOfficeId: request.accountantContext.office.id });
  const ids = result.data.map((document) => document.id);
  const reviews = ids.length ? await prisma.accountantDocumentReview.findMany({
    where: { officeId: request.accountantContext.office.id, fiscalDocumentId: { in: ids } },
    select: { fiscalDocumentId: true, status: true, note: true, reviewedAt: true },
  }) : [];
  const reviewByDocument = new Map(reviews.map((review) => [review.fiscalDocumentId, review]));
  const tags = ids.length ? await prisma.accountantDocumentTagLink.findMany({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: { in: ids } }, include: { tag: { select: { id: true, name: true, color: true } } } }) : [];
  const tagsByDocument = new Map();
  for (const item of tags) tagsByDocument.set(item.fiscalDocumentId, [...(tagsByDocument.get(item.fiscalDocumentId) || []), item.tag]);
  sendSuccess(response, { ...result, data: result.data.map((document) => ({ ...document, review: reviewByDocument.get(document.id) || { status: "PENDING" }, tags: tagsByDocument.get(document.id) || [] })) });
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const detail = await getAccountantFiscalDocumentDetail({ companyId: request.company.id, documentId: request.params.documentId, officeId: request.accountantContext.office.id, canDownload: hasAccountantPermission(request, "fiscal.documents.download_xml") });
  await writeAudit({ request, action: "accountant.fiscal_document.viewed", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id } });
  sendSuccess(response, detail);
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/xml", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const document = await findDocument(request.company.id, request.params.documentId, true);
  sendSuccess(response, { id: document.id, accessKey: document.accessKey, xml: sanitizeXml(document.rawXml || ""), isSummary: document.isSummary, hash: document.xmlHashSha256 });
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/download-xml", asyncHandler(async (request, response) => {
  const document = await findDocument(request.company.id, request.params.documentId, true);
  const availability = document.rawXml ? (document.isSummary ? "SUMMARY" : "FULL") : "MISSING";
  const allowed = canDownloadAccountantXml(
    availability,
    hasAccountantPermission(request, "fiscal.documents.download_xml"),
  );
  if (!allowed) {
    await writeAudit({ request, action: "accountant.fiscal_document.xml_download_denied", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id } });
    if (availability !== "FULL") throw new AppError("XML completo não está disponível para download.", "XML_FULL_NOT_AVAILABLE", 409);
    throw new AppError("Permissão para baixar XML é necessária.", "ACCOUNTANT_XML_DOWNLOAD_FORBIDDEN", 403);
  }
  await prisma.xmlDownloadLog.create({ data: { companyId: request.company.id, fiscalDocumentId: document.id, userId: request.user.id, ipAddress: request.ip } });
  await writeAudit({ request, action: "accountant.fiscal_document.xml_downloaded", companyId: request.company.id, entityType: "FiscalDocument", entityId: document.id, metadata: { officeId: request.accountantContext.office.id, accessKey: document.accessKey } });
  response.setHeader("content-type", "application/xml; charset=utf-8");
  response.setHeader("content-disposition", `attachment; filename=\"NFE-${document.accessKey || document.id}.xml\"`);
  response.send(document.rawXml);
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, deletedAt: null };
  sendSuccess(response, await prisma.accountantDocumentNote.findMany({ where, orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, name: true } } } }));
}));

accountantDocumentsRouter.post("/fiscal-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const payload = noteSchema.parse(request.body);
  await findDocument(request.company.id, request.params.documentId);
  const note = await prisma.accountantDocumentNote.create({ data: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, authorUserId: request.user.id, content: payload.content } });
  await writeAudit({ request, action: "accountant.fiscal_document.note_created", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, noteId: note.id } });
  sendSuccess(response, note, 201);
}));

accountantDocumentsRouter.patch("/fiscal-documents/:documentId/notes/:noteId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const payload = noteSchema.parse(request.body);
  const note = await prisma.accountantDocumentNote.findFirst({ where: { id: request.params.noteId, officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, deletedAt: null } });
  if (!note) throw new AppError("Observação não encontrada.", "ACCOUNTANT_NOTE_NOT_FOUND", 404);
  if (note.authorUserId !== request.user.id && !["OWNER", "ADMIN"].includes(request.accountantContext.membership.role)) throw new AppError("Somente o autor ou administrador pode editar a observação.", "ACCOUNTANT_NOTE_FORBIDDEN", 403);
  const updated = await prisma.accountantDocumentNote.update({ where: { id: note.id }, data: { content: payload.content } });
  await writeAudit({ request, action: "accountant.fiscal_document.note_updated", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, noteId: note.id } });
  sendSuccess(response, updated);
}));

accountantDocumentsRouter.delete("/fiscal-documents/:documentId/notes/:noteId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const note = await prisma.accountantDocumentNote.findFirst({ where: { id: request.params.noteId, officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, deletedAt: null } });
  if (!note) throw new AppError("Observação não encontrada.", "ACCOUNTANT_NOTE_NOT_FOUND", 404);
  if (note.authorUserId !== request.user.id && !["OWNER", "ADMIN"].includes(request.accountantContext.membership.role)) throw new AppError("Somente o autor ou administrador pode excluir a observação.", "ACCOUNTANT_NOTE_FORBIDDEN", 403);
  await prisma.accountantDocumentNote.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
  sendSuccess(response, { id: note.id, deleted: true });
}));

accountantDocumentsRouter.get("/tags", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  sendSuccess(response, await prisma.accountantDocumentTag.findMany({ where: { officeId: request.accountantContext.office.id }, orderBy: { name: "asc" } }));
}));

accountantDocumentsRouter.post("/tags", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_tags");
  const payload = tagSchema.parse(request.body);
  const normalizedName = normalizedTag(payload.name);
  const existing = await prisma.accountantDocumentTag.findUnique({ where: { officeId_normalizedName: { officeId: request.accountantContext.office.id, normalizedName } } });
  if (existing) throw new AppError("Já existe uma etiqueta com este nome no escritório.", "ACCOUNTANT_TAG_DUPLICATE", 409);
  const tag = await prisma.accountantDocumentTag.create({ data: { officeId: request.accountantContext.office.id, name: payload.name, normalizedName, color: payload.color ?? null, createdByUserId: request.user.id } });
  sendSuccess(response, tag, 201);
}));

accountantDocumentsRouter.post("/fiscal-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_tags");
  await findDocument(request.company.id, request.params.documentId);
  const tag = await prisma.accountantDocumentTag.findFirst({ where: { id: request.params.tagId, officeId: request.accountantContext.office.id } });
  if (!tag) throw new AppError("Etiqueta não encontrada.", "ACCOUNTANT_TAG_NOT_FOUND", 404);
  const link = await prisma.accountantDocumentTagLink.upsert({ where: { officeId_fiscalDocumentId_tagId: { officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId, tagId: tag.id } }, create: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, tagId: tag.id }, update: {} });
  sendSuccess(response, link, 201);
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/tags", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const links = await prisma.accountantDocumentTagLink.findMany({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId }, include: { tag: true }, orderBy: { assignedAt: "asc" } });
  sendSuccess(response, links.map((link) => link.tag));
}));

accountantDocumentsRouter.delete("/fiscal-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_tags");
  await prisma.accountantDocumentTagLink.deleteMany({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, tagId: request.params.tagId } });
  sendSuccess(response, { deleted: true });
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/requests", asyncHandler(async (request, response) => {
  requirePermission(request, "accountant.requests.read");
  sendSuccess(response, await prisma.accountantDocumentRequest.findMany({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId }, orderBy: { createdAt: "desc" } }));
}));

accountantDocumentsRouter.post("/fiscal-documents/:documentId/requests", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.create_request");
  const payload = requestSchema.parse(request.body);
  await findDocument(request.company.id, request.params.documentId);
  const duplicate = await prisma.accountantDocumentRequest.findFirst({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, type: payload.type, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  if (duplicate) throw new AppError("Já existe uma solicitação aberta deste tipo para o documento.", "ACCOUNTANT_REQUEST_DUPLICATE", 409);
  const item = await prisma.accountantDocumentRequest.create({ data: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, userId: request.user.id, type: payload.type, priority: payload.priority, description: payload.description ?? null } });
  await writeAudit({ request, action: "accountant.fiscal_document.request_created", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, requestId: item.id, type: item.type, priority: item.priority } });
  sendSuccess(response, item, 201);
}));

accountantDocumentsRouter.post("/fiscal-documents/:documentId/review", asyncHandler(async (request, response) => {
  const payload = reviewSchema.parse(request.body);
  requirePermission(request, payload.status === "REOPENED" ? "fiscal.documents.reopen_review" : "fiscal.documents.review");
  await findDocument(request.company.id, request.params.documentId);
  const previous = await prisma.accountantDocumentReview.findUnique({ where: { officeId_fiscalDocumentId: { officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId } } });
  validateReviewTransition(previous, payload);
  const context = { ...request.accountantContext, company: request.company, user: request.user };
  const review = await prisma.accountantDocumentReview.upsert({
    where: { officeId_fiscalDocumentId: { officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId } },
    create: reviewData(context, request.params.documentId, payload),
    update: reviewData(context, request.params.documentId, payload),
  });
  await writeAudit({ request, action: "accountant.fiscal_document.reviewed", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, previousStatus: previous?.status || null, status: review.status, category: payload.category || null, priority: payload.priority || null } });
  sendSuccess(response, review, 201);
}));

accountantDocumentsRouter.patch("/fiscal-documents/:documentId/review", asyncHandler(async (request, response) => {
  const payload = reviewSchema.parse(request.body);
  requirePermission(request, payload.status === "REOPENED" ? "fiscal.documents.reopen_review" : "fiscal.documents.review");
  await findDocument(request.company.id, request.params.documentId);
  const previous = await prisma.accountantDocumentReview.findUnique({ where: { officeId_fiscalDocumentId: { officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId } } });
  if (!previous) throw new AppError("Conferência não encontrada.", "ACCOUNTANT_REVIEW_NOT_FOUND", 404);
  validateReviewTransition(previous, payload);
  const review = await prisma.accountantDocumentReview.update({
    where: { officeId_fiscalDocumentId: { officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId } },
    data: reviewData({ ...request.accountantContext, company: request.company, user: request.user }, request.params.documentId, payload),
  });
  await writeAudit({ request, action: "accountant.fiscal_document.reviewed", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, previousStatus: previous.status, status: review.status, category: payload.category || null, priority: payload.priority || null } });
  sendSuccess(response, review);
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/review-history", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const entries = await prisma.auditLog.findMany({ where: { companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, action: "accountant.fiscal_document.reviewed", metadata: { path: ["officeId"], equals: request.accountantContext.office.id } }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } });
  sendSuccess(response, entries.map(({ metadata, user, createdAt, id }) => ({ id, createdAt, user, ...(metadata || {}) })));
}));

accountantDocumentsRouter.get("/transport-documents/summary", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const where = { companyId: request.company.id };
  const [total, cancelled, withLinks, pending, amounts] = await Promise.all([
    prisma.transportDocument.count({ where }), prisma.transportDocument.count({ where: { ...where, status: { contains: "CANCEL", mode: "insensitive" } } }),
    prisma.transportDocument.count({ where: { ...where, nfeLinks: { some: { nfeDocumentId: { not: null } } } } }),
    prisma.transportDocument.count({ where: { ...where, nfeLinks: { some: { nfeDocumentId: null } } } }), prisma.transportDocument.aggregate({ where, _sum: { totalAmount: true } }),
  ]);
  sendSuccess(response, { total, cancelled, withLinks, withoutLinks: total - withLinks, pendingReferences: pending, totalAmount: Number(amounts._sum.totalAmount || 0) });
}));

accountantDocumentsRouter.get("/transport-documents", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const { page, pageSize, skip, take } = (await import("../../utils/pagination.js")).getPagination(request.query, 25);
  const where = { companyId: request.company.id, ...(request.query.withLinks === "true" ? { nfeLinks: { some: { nfeDocumentId: { not: null } } } } : request.query.withLinks === "false" ? { nfeLinks: { none: { nfeDocumentId: { not: null } } } } : {}) };
  const [data, total] = await Promise.all([prisma.transportDocument.findMany({ where, orderBy: { emissionDate: "desc" }, skip, take, include: { _count: { select: { nfeLinks: true } } } }), prisma.transportDocument.count({ where })]);
  sendSuccess(response, { data: data.map((cte) => ({ ...cte, totalAmount: Number(cte.totalAmount || 0), xmlAvailability: cte.rawXml ? "FULL" : "MISSING" })), pagination: (await import("../../utils/pagination.js")).paginationMeta(page, pageSize, total) });
}));

accountantDocumentsRouter.post("/transport-documents/:documentId/reprocess-links", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.review");
  const result = await reconcileTransportDocumentLinks({ companyId: request.company.id, transportDocumentId: request.params.documentId });
  if (!result) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  await writeAudit({ request, action: "accountant.transport_document.links_reprocessed", companyId: request.company.id, entityType: "TransportDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id, ...result } });
  sendSuccess(response, result);
}));

accountantDocumentsRouter.get("/transport-documents/:documentId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const cte = await prisma.transportDocument.findFirst({ where: { id: request.params.documentId, companyId: request.company.id }, include: { nfeLinks: { include: { nfeDocument: { select: { id: true, invoiceNumber: true, series: true, accessKey: true, issuerName: true, recipientName: true, emissionDate: true, totalAmount: true, status: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!cte) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  const availability = cte.rawXml ? "FULL" : "MISSING";
  const linked = cte.nfeLinks.filter((link) => link.nfeDocumentId);
  const pending = cte.nfeLinks.filter((link) => !link.nfeDocumentId);
  sendSuccess(response, { id: cte.id, companyId: cte.companyId, identification: { model: "57", number: cte.number, series: cte.series, accessKey: cte.accessKey, issueDate: cte.emissionDate?.toISOString() || null, authorizationDate: null, protocol: null, environment: null, status: cte.status || "UNKNOWN", serviceType: null, emissionType: null, isCancelled: /CANCEL/i.test(cte.status || ""), cancellationDate: null }, issuer: cte.issuerName || cte.issuerCnpj ? { name: cte.issuerName, document: cte.issuerCnpj } : null, recipient: cte.recipientName || cte.recipientCnpj ? { name: cte.recipientName, document: cte.recipientCnpj } : null, route: { startCity: null, startState: null, endCity: null, endState: null }, transport: { modal: null, cfop: null, natureOfOperation: null, predominantProduct: null, cargoValue: null, cargoWeight: null }, totals: { serviceValue: cte.totalAmount?.toString() || null, amountReceivable: null, icmsBase: null, icmsRate: null, icms: null, taxReduction: null, otherTaxes: null }, xml: { availability, canView: availability !== "MISSING", canDownload: canDownloadAccountantXml(availability, hasAccountantPermission(request, "fiscal.transport_documents.download_xml")) }, nfeLinks: linked.map((link) => ({ id: link.id, accessKey: link.nfeAccessKey, source: link.source, createdAt: link.createdAt.toISOString(), document: { ...link.nfeDocument, totalAmount: link.nfeDocument.totalAmount?.toString() || null } })), pendingReferences: pending.map((link) => ({ id: link.id, accessKey: link.nfeAccessKey, source: link.source, createdAt: link.createdAt.toISOString(), status: "PENDING_DOCUMENT" })) });
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/xml", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const cte = await prisma.transportDocument.findFirst({ where: { id: request.params.documentId, companyId: request.company.id }, select: { id: true, accessKey: true, rawXml: true, rawXmlHash: true } });
  if (!cte) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  sendSuccess(response, { id: cte.id, accessKey: cte.accessKey, xml: sanitizeXml(cte.rawXml || ""), hash: cte.rawXmlHash });
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/download-xml", asyncHandler(async (request, response) => {
  const cte = await prisma.transportDocument.findFirst({ where: { id: request.params.documentId, companyId: request.company.id }, select: { id: true, accessKey: true, rawXml: true } });
  if (!cte) throw new AppError("CT-e não encontrado.", "CTE_NOT_FOUND", 404);
  const allowed = canDownloadAccountantXml(cte.rawXml ? "FULL" : "MISSING", hasAccountantPermission(request, "fiscal.transport_documents.download_xml"));
  if (!allowed) { await writeAudit({ request, action: "accountant.transport_document.xml_download_denied", companyId: request.company.id, entityType: "TransportDocument", entityId: cte.id, metadata: { officeId: request.accountantContext.office.id } }); throw new AppError("XML completo e permissão de download são necessários.", "ACCOUNTANT_CTE_XML_DOWNLOAD_FORBIDDEN", 403); }
  await writeAudit({ request, action: "accountant.transport_document.xml_downloaded", companyId: request.company.id, entityType: "TransportDocument", entityId: cte.id, metadata: { officeId: request.accountantContext.office.id } });
  response.setHeader("content-type", "application/xml; charset=utf-8"); response.setHeader("content-disposition", `attachment; filename=\"CTE-${cte.accessKey}.xml\"`); response.send(cte.rawXml);
}));
