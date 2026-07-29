import { getRiskRanking } from "./accountant-risk.service.js";
export async function getAccountantDashboard(prisma, scope, filters) {
  const ids = scope.companyIds;
  const where = { companyId: { in: ids } };
  const [companies, documents, reviews, requests, closings, preparations, guides, certificates, rejections, risks] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, legalName: true, tradeName: true } }),
    prisma.fiscalDocument.count({ where }),
    prisma.accountantDocumentReview.count({ where: { officeId: scope.office.id, companyId: { in: ids }, status: "PENDING" } }),
    prisma.accountantDocumentRequest.count({ where: { officeId: scope.office.id, companyId: { in: ids }, status: { in: ["OPEN", "ACCEPTED", "ANSWERED"] } } }),
    prisma.monthlyTaxClosing.groupBy({ by: ["status"], where, _count: true }),
    prisma.fiscalBookPreparation.groupBy({ by: ["status"], where, _count: true }),
    prisma.taxGuide.count({ where: { ...where, status: { notIn: ["PAID", "CANCELLED"] } } }),
    prisma.digitalCertificate.count({ where: { ...where, validUntil: { lte: new Date(Date.now() + 30 * 86400000) } } }),
    prisma.fiscalDocument.count({ where: { ...where, status: { contains: "REJEIT", mode: "insensitive" } } }),
    getRiskRanking(prisma, scope),
  ]);
  return { office: { id: scope.office.id, name: scope.office.name }, indicators: { linkedCompanies: companies.length, documents, awaitingReview: reviews, openRequests: requests, pendingGuides: guides, expiringCertificates: certificates, rejections, averageRisk: risks.length ? Math.round(risks.reduce((s, r) => s + r.score, 0) / risks.length) : 0 }, closings, preparations, companiesRequiringAction: risks.filter((r) => r.classification !== "HEALTHY"), filters };
}
