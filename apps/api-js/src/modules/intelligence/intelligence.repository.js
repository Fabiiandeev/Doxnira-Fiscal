import { prisma } from "../../config/prisma.js";

const realSources = ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"];

export function periodRange(query = {}) {
  const end = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
  const start = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { start, end };
}

export async function readFiscalFacts(companyId, query) {
  const { start, end } = periodRange(query);
  const where = {
    companyId,
    source: { in: realSources },
    emissionDate: { gte: start, lte: end },
  };
  const [documents, validationIssues, certificate, closing, alerts] = await Promise.all([
    prisma.fiscalDocument.findMany({
      where,
      select: {
        id: true, documentType: true, operationDirection: true, status: true,
        invoiceNumber: true, issuerName: true, totalAmount: true, taxAmount: true,
        emissionDate: true, isCancelled: true, isSummary: true,
      },
      orderBy: { emissionDate: "desc" },
    }),
    prisma.nfeValidationIssue.count({
      where: { companyId, resolved: false, severity: { in: ["ERROR", "CRITICAL"] } },
    }),
    prisma.digitalCertificate.findFirst({
      where: { companyId, status: "active" },
      select: { id: true, validUntil: true, subject: true },
      orderBy: { validUntil: "desc" },
    }),
    prisma.monthlyTaxClosing.findFirst({
      where: { companyId },
      select: { id: true, status: true, periodYear: true, periodMonth: true, updatedAt: true },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    }),
    prisma.alert.count({ where: { companyId, status: { in: ["open", "unread"] } } }),
  ]);
  return { documents, validationIssues, certificate, closing, alerts, start, end };
}

export async function readCommerceFacts(companyId, query) {
  const { start, end } = periodRange(query);
  const [orders, listings, connections, products, failedSyncs] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { companyId, orderedAt: { gte: start, lte: end } },
      include: { items: { select: { quantity: true, totalAmount: true, sku: true } } },
      orderBy: { orderedAt: "desc" },
    }),
    prisma.marketplaceListingLink.findMany({
      where: { companyId },
      select: { id: true, title: true, sku: true, status: true, price: true, syncedAt: true },
    }),
    prisma.marketplaceConnection.count({ where: { companyId, status: "connected" } }),
    prisma.product.findMany({
      where: { companyId },
      select: { id: true, name: true, code: true, stock: true, costPrice: true, price: true },
    }),
    prisma.marketplaceSyncJob.count({ where: { companyId, status: { in: ["failed", "error"] } } }),
  ]);
  return { orders, listings, connections, products, failedSyncs, start, end };
}

export function readCompanies(companyIds) {
  return prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, tradeName: true, legalName: true },
  });
}

export function readAuditActions(companyId, entityType) {
  return prisma.auditLog.findMany({
    where: { companyId, entityType },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function writeAuditAction({ companyId, userId, action, entityType, metadata, request }) {
  return prisma.auditLog.create({
    data: {
      companyId,
      userId,
      action,
      entityType,
      metadata,
      ipAddress: request.ip,
      userAgent: request.get("user-agent") || null,
    },
  });
}
