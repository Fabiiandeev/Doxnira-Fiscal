import { prisma } from "../../config/prisma.js";

export async function fiscalFacts(companyId) {
  const now = new Date();
  const certificateLimit = new Date(now.getTime() + 30 * 864e5);
  const [issues, alerts, certificate, syncFailures, closing, products, rules, documents] = await Promise.all([
    prisma.nfeValidationIssue.findMany({
      where: { companyId, resolved: false },
      include: { validationResult: { select: { nfeDocumentId: true } } },
      orderBy: { createdAt: "desc" }, take: 200,
    }),
    prisma.alert.findMany({ where: { companyId, status: { in: ["open", "unread"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.digitalCertificate.findFirst({ where: { companyId, status: "active" }, orderBy: { validUntil: "desc" } }),
    prisma.marketplaceSyncJob.findMany({ where: { companyId, status: { in: ["failed", "error"] } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.monthlyTaxClosing.findFirst({ where: { companyId }, orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] }),
    prisma.product.findMany({ where: { companyId, OR: [{ ncm: null }, { cfopPreferencial: null }] }, select: { id: true, name: true, ncm: true, cfopPreferencial: true }, take: 100 }),
    prisma.taxRule.count({ where: { companyId, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] } }),
    prisma.fiscalDocument.count({ where: { companyId, source: { in: ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"] } } }),
  ]);
  return { issues, alerts, certificate, certificateLimit, syncFailures, closing, products, rules, documents };
}

export const audit = (data) => prisma.auditLog.create({ data });
export const audits = (companyId, entityType) => prisma.auditLog.findMany({ where: { companyId, entityType }, orderBy: { createdAt: "desc" }, take: 200 });
export const conversationHistory = async (companyId, conversationId) => {
  if (!conversationId) return [];
  const entries = await prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: "FISCAL_AI_CHAT",
      metadata: { path: ["conversationId"], equals: conversationId },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  return entries.reverse().map((entry) => ({
    question: String(entry.metadata?.question || "").slice(0, 4_000),
    answer: String(entry.metadata?.answer || "").slice(0, 12_000),
  })).filter((entry) => entry.question && entry.answer);
};
export const resolveIssue = (companyId, id) => prisma.nfeValidationIssue.updateMany({ where: { companyId, id }, data: { resolved: true } });
export const findIssue = (companyId, id) => prisma.nfeValidationIssue.findFirst({ where: { companyId, id } });

export const listRules = (companyId, query) => prisma.taxRule.findMany({
  where: {
    companyId,
    ...(query.search ? { OR: [{ taxType: { contains: query.search, mode: "insensitive" } }, { cfop: { contains: query.search } }, { ncm: { contains: query.search } }] } : {}),
    ...(query.taxType ? { taxType: query.taxType } : {}),
  },
  orderBy: { updatedAt: "desc" },
  skip: (Number(query.page || 1) - 1) * Math.min(100, Number(query.pageSize || 20)),
  take: Math.min(100, Number(query.pageSize || 20)),
});
export const countRules = (companyId, query) => prisma.taxRule.count({ where: { companyId, ...(query.taxType ? { taxType: query.taxType } : {}) } });
export const getRule = (companyId, id) => prisma.taxRule.findFirst({ where: { companyId, id } });
export const createRule = (companyId, data) => prisma.taxRule.create({ data: { companyId, ...data } });
export const updateRule = (companyId, id, data) => prisma.taxRule.updateMany({ where: { companyId, id }, data });
