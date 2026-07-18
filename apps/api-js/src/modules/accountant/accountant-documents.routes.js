import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { hasAccountantPermission } from "../../middlewares/accountant-company-access.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { sanitizeXml } from "../../utils/sanitize-xml.js";
import { writeAudit } from "../audit/audit.service.js";
import { findDocument, searchDocuments } from "../documents/documents.service.js";
import { canDownloadAccountantXml, getAccountantFiscalDocumentDetail, getAccountantTransportDocumentDetail } from "./accountant-document-detail.service.js";
import { reconcileTransportDocumentLinks } from "../../services/document-link.service.js";
import {
  resolveAccountantDocumentTarget,
  resolveTargetFromRequestParams,
  auditEntityFromTarget,
} from "./accountant-document-target.service.js";

const reviewSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "WITH_ISSUES", "IGNORED", "REOPENED"]),
  note: z.string().max(5_000).optional(),
  reopenReason: z.string().max(2_000).optional(),
  category: z.enum(["CFOP", "NCM", "CEST", "CST", "CSOSN", "XML", "CTE_LINK", "TOTALS", "PARTICIPANT", "CANCELLATION", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
const noteSchema = z.object({ content: z.string().trim().min(1).max(5_000) });
const tagSchema = z.object({ name: z.string().trim().min(1).max(80), color: z.string().trim().max(20).optional() });
const requestSchema = z.object({
  type: z.string().trim().min(1).max(60),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  description: z.string().trim().max(5_000).optional(),
});
const requestTransitionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ANSWERED", "RESOLVED", "CANCELLED"]),
  responseMessage: z.string().trim().max(5_000).optional(),
  reason: z.string().trim().max(5_000).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

const REQUEST_TRANSITIONS = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ANSWERED", "CANCELLED"],
  ANSWERED: ["RESOLVED", "IN_PROGRESS", "CANCELLED"],
  RESOLVED: ["IN_PROGRESS"],
  CANCELLED: [],
};

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

function validateRequestTransition(previous, payload, isCompany, hasAssignGrant) {
  const allowed = REQUEST_TRANSITIONS[previous?.status || "OPEN"] || [];
  if (!allowed.includes(payload.status)) {
    throw new AppError("Transição de solicitação inválida.", "ACCOUNTANT_REQUEST_TRANSITION_INVALID", 422);
  }
  if (payload.status === "ANSWERED" && !hasAssignGrant && !isCompany) {
    throw new AppError("Sem permissão para responder solicitação.", "ACCOUNTANT_REQUEST_RESPOND_FORBIDDEN", 403);
  }
  if (payload.status === "ANSWERED" && !(payload.responseMessage?.trim())) {
    throw new AppError("Resposta é obrigatória para concluir a solicitação.", "ACCOUNTANT_REQUEST_RESPONSE_REQUIRED", 422);
  }
  if (["CANCELLED"].includes(payload.status) && !(payload.reason?.trim())) {
    throw new AppError("Justificativa é obrigatória para cancelamento.", "ACCOUNTANT_REQUEST_REASON_REQUIRED", 422);
  }
  if (previous?.status === "RESOLVED" && payload.status === "IN_PROGRESS" && !(payload.reason?.trim())) {
    throw new AppError("Justificativa é obrigatória para reabertura.", "ACCOUNTANT_REQUEST_REOPEN_REASON_REQUIRED", 422);
  }
  if (payload.status === "RESOLVED" && !(payload.responseMessage?.trim())) {
    throw new AppError("Confirmação de resolução é obrigatória.", "ACCOUNTANT_REQUEST_RESOLVE_REQUIRED", 422);
  }
}

const hasPendingOpenRequest = async (officeId, companyId, request) => {
  if (!["OPEN", "IN_PROGRESS"].includes(request.status)) return false;
  const base = { officeId, companyId, type: request.type, status: { in: ["OPEN", "IN_PROGRESS"] } };
  const nfe = request.fiscalDocumentId
    ? await prisma.accountantDocumentRequest.findFirst({ where: { ...base, fiscalDocumentId: request.fiscalDocumentId, id: { not: request.id } } })
    : null;
  const cte = request.transportDocumentId
    ? await prisma.accountantDocumentRequest.findFirst({ where: { ...base, transportDocumentId: request.transportDocumentId, id: { not: request.id } } })
    : null;
  return Boolean(nfe || cte);
};

async function fiscalSummary(companyId, query, officeId) {
  const start = query.startDate ? new Date(`${query.startDate}T00:00:00`) : undefined;
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999`) : undefined;
  const where = { companyId, ...(start || end ? { emissionDate: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) };
  const [documents, cancelled, alerts, reviews, cteCount] = await Promise.all([
    prisma.fiscalDocument.aggregate({
      where,
      _count: { id: true },
      _sum: { totalAmount: true, icmsAmount: true, ipiAmount: true, pisAmount: true, cofinsAmount: true },
    }),
    prisma.fiscalDocument.count({ where: { ...where, isCancelled: true } }),
    prisma.alert.count({ where: { companyId, status: "open", ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) } }),
    prisma.accountantDocumentReview.count({ where: { companyId, officeId, status: { not: "REVIEWED" } } }),
    prisma.transportDocument.count({ where: { companyId } }),
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
    cteDocuments: cteCount,
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

async function transportSummary(companyId, officeId) {
  const where = { companyId };
  const [total, cancelled, withLinks, pending, amounts, unreviewed] = await Promise.all([
    prisma.transportDocument.count({ where }),
    prisma.transportDocument.count({ where: { ...where, status: { contains: "CANCEL", mode: "insensitive" } } }),
    prisma.transportDocument.count({ where: { ...where, nfeLinks: { some: { nfeDocumentId: { not: null } } } } }),
    prisma.transportDocument.count({ where: { ...where, nfeLinks: { some: { nfeDocumentId: null } } } }),
    prisma.transportDocument.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.accountantDocumentReview.count({ where: { companyId, officeId, transportDocumentId: { not: null }, status: { not: "REVIEWED" } } }),
  ]);
  return {
    total,
    cancelled,
    withLinks,
    withoutLinks: total - withLinks,
    pendingReferences: pending,
    unreviewedDocuments: unreviewed,
    totalAmount: Number(amounts._sum.totalAmount || 0),
  };
}

async function buildTransportWhere(companyId, query) {
  const where = { companyId };
  const term = query.query?.trim();
  if (term) {
    where.OR = [
      { accessKey: { contains: term } },
      { number: { contains: term, mode: "insensitive" } },
      { issuerName: { contains: term, mode: "insensitive" } },
    ];
  }
  if (query.withLinks === "true") where.nfeLinks = { some: { nfeDocumentId: { not: null } } };
  else if (query.withLinks === "false") where.nfeLinks = { none: { nfeDocumentId: { not: null } } };
  if (query.startDate || query.endDate) {
    where.emissionDate = {};
    if (query.startDate) where.emissionDate.gte = new Date(`${query.startDate}T00:00:00`);
    if (query.endDate) where.emissionDate.lte = new Date(`${query.endDate}T23:59:59`);
  }
  if (query.status) where.status = { contains: query.status, mode: "insensitive" };
  return where;
}

export const accountantDocumentsRouter = Router({ mergeParams: true });

accountantDocumentsRouter.get("/fiscal-documents/summary", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  sendSuccess(response, await fiscalSummary(request.company.id, request.query, request.accountantContext.office.id));
}));

accountantDocumentsRouter.get("/fiscal-documents", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
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
  requirePermission(request, "fiscal.documents.download_xml");
  const document = await findDocument(request.company.id, request.params.documentId, true);
  const availability = document.rawXml ? (document.isSummary ? "SUMMARY" : "FULL") : "MISSING";
  const allowed = canDownloadAccountantXml(availability, true);
  if (!allowed) {
    await writeAudit({ request, action: "accountant.fiscal_document.xml_download_denied", companyId: request.company.id, entityType: "FiscalDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id } });
    if (availability !== "FULL") throw new AppError("XML completo não está disponível para download.", "XML_FULL_NOT_AVAILABLE", 409);
    throw new AppError("Permissão para baixar XML é necessária.", "ACCOUNTANT_XML_DOWNLOAD_FORBIDDEN", 403);
  }
  await prisma.xmlDownloadLog.create({ data: { companyId: request.company.id, fiscalDocumentId: document.id, userId: request.user.id, ipAddress: request.ip } });
  await writeAudit({ request, action: "accountant.fiscal_document.xml_downloaded", companyId: request.company.id, entityType: "FiscalDocument", entityId: document.id, metadata: { officeId: request.accountantContext.office.id, accessKey: document.accessKey } });
  response.setHeader("content-type", "application/xml; charset=utf-8");
  response.setHeader("content-disposition", `attachment; filename="NFE-${document.accessKey || document.id}.xml"`);
  response.send(document.rawXml);
}));

// ===== Notes (NF-e) =====
accountantDocumentsRouter.get("/fiscal-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: request.params.documentId, deletedAt: null };
  sendSuccess(response, await prisma.accountantDocumentNote.findMany({ where, orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, name: true } } } }));
}));

accountantDocumentsRouter.post("/fiscal-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const payload = noteSchema.parse(request.body);
  const targetParams = resolveTargetFromRequestParams(request, { kind: "FISCAL" });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const note = await prisma.accountantDocumentNote.create({ data: { officeId: request.accountantContext.office.id, companyId: request.company.id, fiscalDocumentId: target.documentId, authorUserId: request.user.id, content: payload.content } });
  await writeAudit({ request, action: "accountant.fiscal_document.note_created", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, noteId: note.id } });
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

// ===== Tags =====
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

async function assignTagToTarget({ request, response, kind }) {
  requirePermission(request, "fiscal.documents.manage_tags");
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const tag = await prisma.accountantDocumentTag.findFirst({ where: { id: request.params.tagId, officeId: request.accountantContext.office.id } });
  if (!tag) throw new AppError("Etiqueta não encontrada.", "ACCOUNTANT_TAG_NOT_FOUND", 404);
  const whereUnique = target.kind === "FISCAL"
    ? { officeId_fiscalDocumentId_tagId: { officeId: request.accountantContext.office.id, fiscalDocumentId: target.documentId, tagId: tag.id } }
    : { officeId_transportDocumentId_tagId: { officeId: request.accountantContext.office.id, transportDocumentId: target.documentId, tagId: tag.id } };
  const data = { officeId: request.accountantContext.office.id, companyId: request.company.id, tagId: tag.id, ...target.where };
  const link = await prisma.accountantDocumentTagLink.upsert({ where: whereUnique, create: data, update: {} });
  await writeAudit({ request, action: target.kind === "FISCAL" ? "accountant.fiscal_document.tag_assigned" : "accountant.transport_document.tag_assigned", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, tagId: tag.id, linkId: link.id } });
  return link;
}

async function listTagsForTarget({ request, response, kind }) {
  requirePermission(request, "fiscal.documents.read");
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id, ...target.where };
  const links = await prisma.accountantDocumentTagLink.findMany({ where, include: { tag: true }, orderBy: { assignedAt: "asc" } });
  return links.map((link) => link.tag);
}

async function removeTagFromTarget({ request, kind }) {
  requirePermission(request, "fiscal.documents.manage_tags");
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const result = await prisma.accountantDocumentTagLink.deleteMany({ where: { officeId: request.accountantContext.office.id, companyId: request.company.id, tagId: request.params.tagId, ...target.where } });
  await writeAudit({ request, action: target.kind === "FISCAL" ? "accountant.fiscal_document.tag_removed" : "accountant.transport_document.tag_removed", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, tagId: request.params.tagId, removed: result.count } });
  return { deleted: true };
}

accountantDocumentsRouter.post("/fiscal-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  const link = await assignTagToTarget({ request, response, kind: "FISCAL" });
  sendSuccess(response, link, 201);
}));
accountantDocumentsRouter.get("/fiscal-documents/:documentId/tags", asyncHandler(async (request, response) => {
  sendSuccess(response, await listTagsForTarget({ request, response, kind: "FISCAL" }));
}));
accountantDocumentsRouter.delete("/fiscal-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  sendSuccess(response, await removeTagFromTarget({ request, kind: "FISCAL" }));
}));

// ===== Requests (NF-e) =====
async function listRequestsForTarget({ request, kind }) {
  requirePermission(request, "accountant.requests.read");
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id, ...target.where };
  return prisma.accountantDocumentRequest.findMany({ where, orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { id: true, name: true } } } });
}

async function createRequestForTarget({ request, kind }) {
  requirePermission(request, "fiscal.documents.create_request");
  const payload = requestSchema.parse(request.body);
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const duplicate = await prisma.accountantDocumentRequest.findFirst({
    where: { officeId: request.accountantContext.office.id, companyId: request.company.id, type: payload.type, status: { in: ["OPEN", "IN_PROGRESS"] }, ...target.where },
  });
  if (duplicate) throw new AppError(" Já existe uma solicitação aberta deste tipo para o documento.", "ACCOUNTANT_REQUEST_DUPLICATE", 409);
  const item = await prisma.accountantDocumentRequest.create({
    data: { officeId: request.accountantContext.office.id, companyId: request.company.id, userId: request.user.id, type: payload.type, priority: payload.priority, description: payload.description ?? null, ...target.where },
  });
  await prisma.accountantDocumentRequestEvent.create({ data: { requestId: item.id, officeId: item.officeId, companyId: item.companyId, actorUserId: request.user.id, actorRole: "ACCOUNTANT", eventType: "REQUEST_CREATED", toStatus: "OPEN", message: item.description } });
  await writeAudit({ request, action: target.kind === "FISCAL" ? "accountant.fiscal_document.request_created" : "accountant.transport_document.request_created", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, requestId: item.id, type: item.type, priority: item.priority } });
  return item;
}

accountantDocumentsRouter.get("/fiscal-documents/:documentId/requests", asyncHandler(async (request, response) => {
  sendSuccess(response, await listRequestsForTarget({ request, kind: "FISCAL" }));
}));
accountantDocumentsRouter.post("/fiscal-documents/:documentId/requests", asyncHandler(async (request, response) => {
  sendSuccess(response, await createRequestForTarget({ request, kind: "FISCAL" }), 201);
}));

// ===== Review (NF-e) =====
async function applyReview({ request, kind, method }) {
  const payload = reviewSchema.parse(request.body);
  requirePermission(request, payload.status === "REOPENED" ? "fiscal.documents.reopen_review" : "fiscal.documents.review");
  const targetParams = resolveTargetFromRequestParams(request, { kind });
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, ...targetParams });
  const previous = await prisma.accountantDocumentReview.findUnique({ where: target.uniqueKey });
  if (method === "PATCH" && !previous) throw new AppError("Conferência não encontrada.", "ACCOUNTANT_REVIEW_NOT_FOUND", 404);
  validateReviewTransition(previous, payload);
  const now = new Date();
  const data = {
    officeId: request.accountantContext.office.id,
    companyId: request.company.id,
    userId: request.user.id,
    status: payload.status,
    note: payload.note ?? null,
    reviewedAt: payload.status === "REVIEWED" || payload.status === "WITH_ISSUES" || payload.status === "IGNORED" ? now : null,
    reopenedAt: payload.status === "REOPENED" ? now : null,
    reopenReason: payload.status === "REOPENED" ? payload.reopenReason ?? null : null,
    ...target.where,
  };
  const review = method === "POST"
    ? await prisma.accountantDocumentReview.upsert({ where: target.uniqueKey, create: data, update: data })
    : await prisma.accountantDocumentReview.update({ where: target.uniqueKey, data });
  await writeAudit({ request, action: target.kind === "FISCAL" ? "accountant.fiscal_document.reviewed" : "accountant.transport_document.reviewed", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, previousStatus: previous?.status || null, status: review.status, category: payload.category || null, priority: payload.priority || null } });
  return review;
}

accountantDocumentsRouter.post("/fiscal-documents/:documentId/review", asyncHandler(async (request, response) => {
  sendSuccess(response, await applyReview({ request, kind: "FISCAL", method: "POST" }), 201);
}));
accountantDocumentsRouter.patch("/fiscal-documents/:documentId/review", asyncHandler(async (request, response) => {
  sendSuccess(response, await applyReview({ request, kind: "FISCAL", method: "PATCH" }));
}));

accountantDocumentsRouter.get("/fiscal-documents/:documentId/review-history", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, fiscalDocumentId: request.params.documentId });
  const action = target.kind === "FISCAL" ? "accountant.fiscal_document.reviewed" : "accountant.transport_document.reviewed";
  const entries = await prisma.auditLog.findMany({ where: { companyId: request.company.id, entityType: auditEntityFromTarget(target).entityType, entityId: request.params.documentId, action, metadata: { path: ["officeId"], equals: request.accountantContext.office.id } }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } });
  sendSuccess(response, entries.map(({ metadata, user, createdAt, id }) => ({ id, createdAt, user, ...(metadata || {}) })));
}));

// ===== Transport documents: list, summary, detail, XML, download, reprocess =====
accountantDocumentsRouter.get("/transport-documents/summary", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  sendSuccess(response, await transportSummary(request.company.id, request.accountantContext.office.id));
}));

accountantDocumentsRouter.get("/transport-documents", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const { page, pageSize, skip, take } = getPagination(request.query, 25);
  const where = await buildTransportWhere(request.company.id, request.query);
  const [data, total] = await Promise.all([
    prisma.transportDocument.findMany({ where, orderBy: { emissionDate: "desc" }, skip, take, include: { _count: { select: { nfeLinks: true } } } }),
    prisma.transportDocument.count({ where }),
  ]);
  sendSuccess(response, { data: data.map((cte) => ({ ...cte, totalAmount: Number(cte.totalAmount || 0), xmlAvailability: cte.rawXml ? "FULL" : "MISSING" })), pagination: paginationMeta(page, pageSize, total) });
}));

accountantDocumentsRouter.post("/transport-documents/:documentId/reprocess-links", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.review");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const result = await reconcileTransportDocumentLinks({ companyId: request.company.id, transportDocumentId: target.documentId });
  await writeAudit({ request, action: "accountant.transport_document.links_reprocessed", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, ...result } });
  sendSuccess(response, result);
}));

accountantDocumentsRouter.get("/transport-documents/:documentId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const detail = await getAccountantTransportDocumentDetail({ companyId: request.company.id, documentId: request.params.documentId, officeId: request.accountantContext.office.id, canDownload: hasAccountantPermission(request, "fiscal.transport_documents.download_xml"), canDownloadNfe: hasAccountantPermission(request, "fiscal.documents.download_xml") });
  await writeAudit({ request, action: "accountant.transport_document.viewed", companyId: request.company.id, entityType: "TransportDocument", entityId: request.params.documentId, metadata: { officeId: request.accountantContext.office.id } });
  sendSuccess(response, detail);
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/xml", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  sendSuccess(response, { id: target.targetDocument.id, accessKey: target.targetDocument.accessKey, xml: sanitizeXml(target.targetDocument.rawXml || ""), hash: target.targetDocument.rawXmlHash, availability: target.targetDocument.rawXml ? "FULL" : "MISSING" });
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/download-xml", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.transport_documents.download_xml");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const availability = target.targetDocument.rawXml ? "FULL" : "MISSING";
  const allowed = canDownloadAccountantXml(availability, true);
  if (!allowed) {
    await writeAudit({ request, action: "accountant.transport_document.xml_download_denied", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id } });
    throw new AppError("XML completo e permissão de download são necessários.", "ACCOUNTANT_CTE_XML_DOWNLOAD_FORBIDDEN", 403);
  }
  await writeAudit({ request, action: "accountant.transport_document.xml_downloaded", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { accessKey: target.targetDocument.accessKey } });
  response.setHeader("content-type", "application/xml; charset=utf-8");
  response.setHeader("content-disposition", `attachment; filename="CTE-${target.targetDocument.accessKey}.xml"`);
  response.send(target.targetDocument.rawXml);
}));

// ===== Transport documents: notes, tags, requests, review, history (paridade CT-e) =====
accountantDocumentsRouter.get("/transport-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id, ...target.where, deletedAt: null };
  sendSuccess(response, await prisma.accountantDocumentNote.findMany({ where, orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, name: true } } } }));
}));

accountantDocumentsRouter.post("/transport-documents/:documentId/notes", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const payload = noteSchema.parse(request.body);
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const note = await prisma.accountantDocumentNote.create({ data: { officeId: request.accountantContext.office.id, companyId: request.company.id, authorUserId: request.user.id, content: payload.content, ...target.where } });
  await writeAudit({ request, action: "accountant.transport_document.note_created", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, noteId: note.id } });
  sendSuccess(response, note, 201);
}));

accountantDocumentsRouter.patch("/transport-documents/:documentId/notes/:noteId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const payload = noteSchema.parse(request.body);
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const note = await prisma.accountantDocumentNote.findFirst({ where: { id: request.params.noteId, officeId: request.accountantContext.office.id, companyId: request.company.id, ...target.where, deletedAt: null } });
  if (!note) throw new AppError("Observação não encontrada.", "ACCOUNTANT_NOTE_NOT_FOUND", 404);
  if (note.authorUserId !== request.user.id && !["OWNER", "ADMIN"].includes(request.accountantContext.membership.role)) throw new AppError("Somente o autor ou administrador pode editar a observação.", "ACCOUNTANT_NOTE_FORBIDDEN", 403);
  const updated = await prisma.accountantDocumentNote.update({ where: { id: note.id }, data: { content: payload.content } });
  await writeAudit({ request, action: "accountant.transport_document.note_updated", companyId: request.company.id, ...auditEntityFromTarget(target), metadata: { officeId: request.accountantContext.office.id, noteId: note.id } });
  sendSuccess(response, updated);
}));

accountantDocumentsRouter.delete("/transport-documents/:documentId/notes/:noteId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.manage_notes");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const note = await prisma.accountantDocumentNote.findFirst({ where: { id: request.params.noteId, officeId: request.accountantContext.office.id, companyId: request.company.id, ...target.where, deletedAt: null } });
  if (!note) throw new AppError("Observação não encontrada.", "ACCOUNTANT_NOTE_NOT_FOUND", 404);
  if (note.authorUserId !== request.user.id && !["OWNER", "ADMIN"].includes(request.accountantContext.membership.role)) throw new AppError("Somente o autor ou administrador pode excluir a observação.", "ACCOUNTANT_NOTE_FORBIDDEN", 403);
  await prisma.accountantDocumentNote.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
  sendSuccess(response, { id: note.id, deleted: true });
}));

accountantDocumentsRouter.post("/transport-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  const link = await assignTagToTarget({ request, response, kind: "TRANSPORT" });
  sendSuccess(response, link, 201);
}));
accountantDocumentsRouter.get("/transport-documents/:documentId/tags", asyncHandler(async (request, response) => {
  sendSuccess(response, await listTagsForTarget({ request, response, kind: "TRANSPORT" }));
}));
accountantDocumentsRouter.delete("/transport-documents/:documentId/tags/:tagId", asyncHandler(async (request, response) => {
  sendSuccess(response, await removeTagFromTarget({ request, kind: "TRANSPORT" }));
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/requests", asyncHandler(async (request, response) => {
  sendSuccess(response, await listRequestsForTarget({ request, kind: "TRANSPORT" }));
}));
accountantDocumentsRouter.post("/transport-documents/:documentId/requests", asyncHandler(async (request, response) => {
  sendSuccess(response, await createRequestForTarget({ request, kind: "TRANSPORT" }), 201);
}));

accountantDocumentsRouter.post("/transport-documents/:documentId/review", asyncHandler(async (request, response) => {
  sendSuccess(response, await applyReview({ request, kind: "TRANSPORT", method: "POST" }), 201);
}));
accountantDocumentsRouter.patch("/transport-documents/:documentId/review", asyncHandler(async (request, response) => {
  sendSuccess(response, await applyReview({ request, kind: "TRANSPORT", method: "PATCH" }));
}));

accountantDocumentsRouter.get("/transport-documents/:documentId/review-history", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.read");
  const target = await resolveAccountantDocumentTarget({ companyId: request.company.id, officeId: request.accountantContext.office.id, transportDocumentId: request.params.documentId });
  const action = "accountant.transport_document.reviewed";
  const entries = await prisma.auditLog.findMany({ where: { companyId: request.company.id, entityType: auditEntityFromTarget(target).entityType, entityId: request.params.documentId, action, metadata: { path: ["officeId"], equals: request.accountantContext.office.id } }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } });
  sendSuccess(response, entries.map(({ metadata, user, createdAt, id }) => ({ id, createdAt, user, ...(metadata || {}) })));
}));

// ===== Request lifecycle (contador e empresa) =====
accountantDocumentsRouter.patch("/requests/:requestId", asyncHandler(async (request, response) => {
  requirePermission(request, "fiscal.documents.respond_request");
  const payload = requestTransitionSchema.parse(request.body);
  const item = await prisma.accountantDocumentRequest.findFirst({
    where: {
      id: request.params.requestId,
      companyId: request.company.id,
      officeId: request.accountantContext.office.id,
    },
  });
  if (!item) throw new AppError("Solicitação não encontrada.", "ACCOUNTANT_REQUEST_NOT_FOUND", 404);
  const companyId = request.company.id;
  const officeId = request.accountantContext.office.id;
  const target = item.fiscalDocumentId
    ? await resolveAccountantDocumentTarget({ companyId, officeId, fiscalDocumentId: item.fiscalDocumentId })
    : await resolveAccountantDocumentTarget({ companyId, officeId, transportDocumentId: item.transportDocumentId });
  // Verifica duplicidade ativa do mesmo tipo para o mesmo documento (transições que não terminais).
  if (["IN_PROGRESS"].includes(payload.status)) {
    if (await hasPendingOpenRequest(officeId, companyId, item)) {
      throw new AppError("Já existe uma solicitação aberta deste tipo para o documento.", "ACCOUNTANT_REQUEST_DUPLICATE", 409);
    }
  }
  const isCompany = false;
  const hasAssignGrant = hasAccountantPermission(request, "fiscal.documents.respond_request");
  validateRequestTransition(item, payload, isCompany, hasAssignGrant);
  const now = new Date();
  const data = { status: payload.status };
  if (payload.status === "IN_PROGRESS" && item.status === "ANSWERED") { data.reopenedAt = now; data.reopenReason = payload.reason; }
  if (payload.status === "RESOLVED") { data.resolutionNote = payload.responseMessage; data.resolvedAt = now; data.resolvedByUserId = request.user.id; }
  if (payload.status === "CANCELLED") { data.cancelledAt = now; data.cancelledByUserId = request.user.id; data.cancelReason = payload.reason; }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.accountantDocumentRequest.update({ where: { id: item.id }, data });
    const eventType = payload.status === "RESOLVED" ? "REQUEST_RESOLVED" : payload.status === "CANCELLED" ? "REQUEST_CANCELLED" : item.status === "ANSWERED" ? "REQUEST_RETURNED" : "REQUEST_REOPENED";
    await tx.accountantDocumentRequestEvent.create({ data: { requestId: item.id, officeId, companyId, actorUserId: request.user.id, actorRole: "ACCOUNTANT", eventType, fromStatus: item.status, toStatus: changed.status, message: payload.reason || payload.responseMessage || null } });
    return changed;
  });
  await writeAudit({ request, action: target.kind === "FISCAL" ? "accountant.fiscal_document.request_transition" : "accountant.transport_document.request_transition", companyId, ...auditEntityFromTarget(target), metadata: { officeId, requestId: item.id, previousStatus: item.status, status: updated.status } });
  sendSuccess(response, updated);
}));

accountantDocumentsRouter.get("/requests", asyncHandler(async (request, response) => {
  requirePermission(request, "accountant.requests.read");
  const where = { officeId: request.accountantContext.office.id, companyId: request.company.id };
  if (request.query.status) where.status = request.query.status;
  if (request.query.priority) where.priority = request.query.priority;
  if (request.query.type) where.type = { contains: request.query.type, mode: "insensitive" };
  if (request.query.documentKind === "FISCAL") where.fiscalDocumentId = { not: null };
  if (request.query.documentKind === "TRANSPORT") where.transportDocumentId = { not: null };
  sendSuccess(response, await prisma.accountantDocumentRequest.findMany({ where, orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { id: true, name: true } } } }));
}));
