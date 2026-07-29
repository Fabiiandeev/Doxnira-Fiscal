export function createSettingsRepository(prisma) {
  return {
    company: (id) => prisma.company.findUnique({ where: { id }, include: { taxSettings: true, warehouses: { select: { id: true, name: true, status: true } } } }),
    certificate: (companyId) => prisma.digitalCertificate.findFirst({ where: { companyId, status: { not: "deleted" } }, orderBy: { createdAt: "desc" }, select: { id: true, serialNumber: true, subject: true, issuer: true, validFrom: true, validUntil: true, holderCnpj: true, validatedAt: true, status: true, createdAt: true, updatedAt: true } }),
    marketplaces: (companyId) => prisma.marketplaceConnection.findMany({ where: { companyId }, select: { id: true, provider: true, status: true, connectedAt: true, lastSyncAt: true, metadata: true, updatedAt: true } }),
    banks: (companyId) => prisma.bankIntegration.findMany({ where: { companyId }, select: { id: true, provider: true, status: true, lastSyncAt: true, lastError: true, updatedAt: true } }),
  };
}
