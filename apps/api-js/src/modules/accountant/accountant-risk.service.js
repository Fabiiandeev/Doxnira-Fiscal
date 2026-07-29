const WEIGHTS = { criticalAlert: 24, highAlert: 14, rejectedDocument: 12, expiredCertificate: 20, closingLate: 15, reopenedClosing: 10, blockedBook: 12, unansweredRequest: 8, overdueGuide: 12 };
export function classifyRisk(score) {
  if (score >= 75) return "CRITICAL"; if (score >= 50) return "HIGH"; if (score >= 25) return "MEDIUM"; if (score > 0) return "LOW"; return "HEALTHY";
}
export function calculateCompanyRisk(evidence) {
  const factors = Object.entries(WEIGHTS).map(([key, weight]) => ({ key, count: evidence[key] || 0, weight, penalty: Math.min(30, (evidence[key] || 0) * weight) })).filter((item) => item.count);
  const score = Math.min(100, factors.reduce((sum, item) => sum + item.penalty, 0));
  return { score, classification: classifyRisk(score), factors };
}
export async function getRiskRanking(prisma, scope) {
  const companies = await prisma.company.findMany({ where: { id: { in: scope.companyIds }, status: { not: "deleted" } }, select: { id: true, legalName: true, tradeName: true } });
  return Promise.all(companies.map(async (company) => {
    const now = new Date();
    const [criticalAlert, highAlert, rejectedDocument, expiredCertificate, closingLate, reopenedClosing, blockedBook, unansweredRequest, overdueGuide] = await Promise.all([
      prisma.alert.count({ where: { companyId: company.id, status: "open", severity: "critical" } }),
      prisma.alert.count({ where: { companyId: company.id, status: "open", severity: "high" } }),
      prisma.fiscalDocument.count({ where: { companyId: company.id, OR: [{ status: { contains: "REJEIT", mode: "insensitive" } }, { isCancelled: true }] } }),
      prisma.digitalCertificate.count({ where: { companyId: company.id, OR: [{ validUntil: { lt: now } }, { status: { not: "active" } }] } }),
      prisma.monthlyTaxClosing.count({ where: { companyId: company.id, status: { in: ["DRAFT", "PREPARING", "BLOCKED"] } } }),
      prisma.monthlyTaxClosing.count({ where: { companyId: company.id, reopenedAt: { not: null } } }),
      prisma.fiscalBookPreparation.count({ where: { companyId: company.id, OR: [{ status: "BLOCKED" }, { blockingIssuesCount: { gt: 0 } }] } }),
      prisma.accountantDocumentRequest.count({ where: { officeId: scope.office.id, companyId: company.id, status: { in: ["OPEN", "ACCEPTED"] } } }),
      prisma.taxGuide.count({ where: { companyId: company.id, dueDate: { lt: now }, status: { notIn: ["PAID", "CANCELLED"] } } }),
    ]);
    const evidence = { criticalAlert, highAlert, rejectedDocument, expiredCertificate, closingLate, reopenedClosing, blockedBook, unansweredRequest, overdueGuide };
    const risk = calculateCompanyRisk(evidence);
    return { companyId: company.id, companyName: company.tradeName || company.legalName, ...risk, evidence, recommendedActions: risk.factors.slice(0, 3).map((f) => `Tratar ${f.key}`), updatedAt: now };
  })).then((items) => items.sort((a, b) => b.score - a.score));
}
