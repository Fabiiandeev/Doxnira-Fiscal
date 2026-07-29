export async function getValueReport(prisma, scope, filters) {
  const end = filters.to || new Date(); const start = filters.from || new Date(end.getTime() - 30 * 86400000); const duration = end.getTime() - start.getTime();
  const previous = { gte: new Date(start.getTime() - duration), lt: start }; const current = { gte: start, lte: end };
  const where = { companyId: { in: scope.companyIds } };
  async function metrics(period) {
    const [documents, reviewed, rejections, resolvedRequests, closings, preparations, monitoredCertificates, resolvedQueue] = await Promise.all([
      prisma.fiscalDocument.count({ where: { ...where, createdAt: period } }),
      prisma.accountantDocumentReview.count({ where: { officeId: scope.office.id, companyId: { in: scope.companyIds }, reviewedAt: period } }),
      prisma.fiscalDocument.count({ where: { ...where, createdAt: period, status: { contains: "REJEIT", mode: "insensitive" } } }),
      prisma.accountantDocumentRequest.count({ where: { officeId: scope.office.id, companyId: { in: scope.companyIds }, resolvedAt: period } }),
      prisma.monthlyTaxClosing.count({ where: { ...where, approvedAt: period } }),
      prisma.fiscalBookPreparation.count({ where: { ...where, generatedAt: period } }),
      prisma.digitalCertificate.count({ where }),
      prisma.accountantFiscalQueueItem.count({ where: { officeId: scope.office.id, companyId: { in: scope.companyIds }, resolvedAt: period } }),
    ]);
    return { documentsProcessed: documents, documentsReviewed: reviewed, rejectionsIdentified: rejections, requestsResolved: resolvedRequests, closingsCompleted: closings, fiscalPreparationsCompleted: preparations, companiesServed: scope.companyIds.length, certificatesMonitored: monitoredCertificates, occurrencesResolved: resolvedQueue };
  }
  return { period: { from: start, to: end }, current: await metrics(current), previous: await metrics(previous), prohibitedFinancialEstimatesIncluded: false };
}
