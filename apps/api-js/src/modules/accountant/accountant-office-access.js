import { AppError } from "../../utils/app-error.js";

export async function resolveOfficeScope(prisma, userId, officeId, requestedCompanyId) {
  const membership = await prisma.accountantMembership.findFirst({
    where: { userId, officeId, status: "ACTIVE" },
    include: { office: true, companyAccesses: { where: { revokedAt: null } } },
  });
  if (!membership) throw new AppError("Escritório contábil não encontrado.", "ACCOUNTANT_OFFICE_NOT_FOUND", 404);
  const links = await prisma.accountantCompanyLink.findMany({
    where: { officeId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { companyId: true },
  });
  const linked = new Set(links.map((item) => item.companyId));
  const grants = membership.companyAccesses.filter((item) => linked.has(item.companyId));
  const companyIds = grants.map((item) => item.companyId);
  if (requestedCompanyId && !companyIds.includes(requestedCompanyId)) {
    throw new AppError("Recurso contábil não encontrado.", "ACCOUNTANT_SCOPE_NOT_FOUND", 404);
  }
  return {
    membership, office: membership.office,
    grants, companyIds: requestedCompanyId ? [requestedCompanyId] : companyIds,
    canWrite: membership.role !== "VIEWER",
  };
}

export function requireOfficeWrite(scope) {
  if (!scope.canWrite) throw new AppError("Permissão contábil de escrita necessária.", "ACCOUNTANT_WRITE_FORBIDDEN", 403);
}
