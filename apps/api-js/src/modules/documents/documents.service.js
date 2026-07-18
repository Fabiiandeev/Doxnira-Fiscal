import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";

export const documentListSelect = {
  id: true,
  accessKey: true,
  nsu: true,
  invoiceNumber: true,
  series: true,
  model: true,
  issuerName: true,
  issuerCnpj: true,
  recipientName: true,
  recipientCnpj: true,
  emissionDate: true,
  authorizationDate: true,
  totalAmount: true,
  status: true,
  manifestationStatus: true,
  isSummary: true,
  isCancelled: true,
  isNewSupplier: true,
  uf: true,
  cfop: true,
  protocol: true,
  schemaName: true,
  documentType: true,
  operationDirection: true,
  companyRole: true,
  source: true,
  productsAmount: true,
  freightAmount: true,
  discountAmount: true,
  icmsAmount: true,
  ipiAmount: true,
  pisAmount: true,
  cofinsAmount: true,
  icmsBase: true,
  icmsStAmount: true,
  fcpAmount: true,
  otherAmount: true,
  taxAmount: true,
  createdAt: true,
};

function serializeDocument(document) {
  return {
    ...document,
    totalAmount: document.totalAmount == null ? 0 : Number(document.totalAmount),
    productsAmount: Number(document.productsAmount || 0),
    freightAmount: Number(document.freightAmount || 0),
    discountAmount: Number(document.discountAmount || 0),
    icmsAmount: Number(document.icmsAmount || 0),
    ipiAmount: Number(document.ipiAmount || 0),
    pisAmount: Number(document.pisAmount || 0),
    cofinsAmount: Number(document.cofinsAmount || 0),
    icmsBase: Number(document.icmsBase || 0),
    icmsStAmount: Number(document.icmsStAmount || 0),
    fcpAmount: Number(document.fcpAmount || 0),
    otherAmount: Number(document.otherAmount || 0),
    taxAmount: Number(document.taxAmount || 0),
    xmlType: document.isSummary ? "SUMMARY" : "FULL",
  };
}

export function buildWhere(companyId, query) {
  const where = { companyId };
  const term = query.query?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    where.OR = [
      { accessKey: { contains: term, mode: "insensitive" } },
      { issuerName: { contains: term, mode: "insensitive" } },
      { invoiceNumber: { contains: term, mode: "insensitive" } },
      { nsu: { contains: term } },
      { protocol: { contains: term, mode: "insensitive" } },
      ...(digits ? [{ issuerCnpj: { contains: digits } }] : []),
    ];
  }
  if (query.status) where.status = query.status;
  if (query.documentType) where.documentType = query.documentType;
  if (query.operationDirection) where.operationDirection = query.operationDirection;
  if (query.source) where.source = query.source;
  if (query.hasLinkedCte === "true") where.transportLinks = { some: {} };
  if (query.hasLinkedCte === "false") where.transportLinks = { none: {} };
  if (query.xmlType) where.isSummary = query.xmlType === "SUMMARY";
  if (query.manifestation) where.manifestationStatus = query.manifestation;
  if (query.uf) where.uf = query.uf;
  if (query.onlyNewSuppliers === "true") where.isNewSupplier = true;
  if (query.cancelled === "true") where.isCancelled = true;
  if (query.hasAlerts === "true") where.alerts = { some: { status: "open" } };
  if (query.hasAlerts === "false") where.alerts = { none: { status: "open" } };
  if (query.reviewStatus && query.accountantOfficeId) {
    where.accountantReviews = query.reviewStatus === "PENDING"
      ? { none: { officeId: query.accountantOfficeId } }
      : { some: { officeId: query.accountantOfficeId, status: query.reviewStatus } };
  }
  if (query.tagId && query.accountantOfficeId) {
    where.accountantTagLinks = { some: { officeId: query.accountantOfficeId, tagId: query.tagId } };
  }
  if (query.startDate || query.endDate) {
    where.emissionDate = {};
    if (query.startDate) where.emissionDate.gte = new Date(`${query.startDate}T00:00:00`);
    if (query.endDate) where.emissionDate.lte = new Date(`${query.endDate}T23:59:59`);
  }
  if (query.minAmount || query.maxAmount) {
    where.totalAmount = {};
    if (query.minAmount) where.totalAmount.gte = new Prisma.Decimal(query.minAmount);
    if (query.maxAmount) where.totalAmount.lte = new Prisma.Decimal(query.maxAmount);
  }
  return where;
}

export async function searchDocuments(companyId, query) {
  const { page, pageSize, skip, take } = getPagination(query, 10);
  const where = buildWhere(companyId, query);
  const sortFields = new Set(["emissionDate", "totalAmount", "issuerName", "invoiceNumber", "createdAt"]);
  const sortBy = sortFields.has(query.sortBy) ? query.sortBy : "emissionDate";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const [data, total] = await Promise.all([
    prisma.fiscalDocument.findMany({
      where,
      select: documentListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.fiscalDocument.count({ where }),
  ]);

  return {
    data: data.map(serializeDocument),
    pagination: paginationMeta(page, pageSize, total),
  };
}

export async function findDocument(companyId, documentId, includeXml = false) {
  const document = await prisma.fiscalDocument.findFirst({
    where: { id: documentId, companyId },
    select: {
      ...documentListSelect,
      products: true,
      taxes: true,
      items: { orderBy: { itemNumber: "asc" } },
      ...(includeXml ? { rawXml: true, xmlHashSha256: true, xmlStorageKey: true } : {}),
    },
  });
  if (!document) {
    throw new AppError("Documento fiscal não encontrado.", "DOCUMENT_NOT_FOUND", 404);
  }
  return serializeDocument(document);
}
