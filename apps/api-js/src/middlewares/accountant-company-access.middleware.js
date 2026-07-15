import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/response.js";

function requestedOfficeId(request) {
  const value = request.get("x-accountant-office-id");
  return value?.trim() || null;
}

export const requireAccountantCompanyAccess = asyncHandler(async (request, _response, next) => {
  const companyId = request.params.companyId;
  const officeId = requestedOfficeId(request);
  const memberships = await prisma.accountantMembership.findMany({
    where: {
      userId: request.user.id,
      status: "ACTIVE",
      ...(officeId ? { officeId } : {}),
    },
    select: { id: true, officeId: true, role: true, office: { select: { id: true, name: true } } },
  });

  if (!memberships.length) {
    throw new AppError("Acesso contábil ativo é necessário.", "ACCOUNTANT_ACCESS_REQUIRED", 403);
  }
  if (!officeId && memberships.length > 1) {
    throw new AppError("Selecione o escritório contábil ativo.", "ACCOUNTANT_OFFICE_REQUIRED", 422);
  }

  const membership = memberships[0];
  const [link, access, company] = await Promise.all([
    prisma.accountantCompanyLink.findFirst({
      where: {
        officeId: membership.officeId,
        companyId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    }),
    prisma.accountantUserCompanyAccess.findFirst({
      where: { membershipId: membership.id, companyId, revokedAt: null },
      select: { id: true, accessLevel: true, permissions: true },
    }),
    prisma.company.findFirst({
      where: { id: companyId, status: { not: "deleted" } },
      select: {
        id: true, legalName: true, tradeName: true, cnpj: true, uf: true, environment: true,
        nfeLastNsu: true, nfeMaxNsu: true, nfeNextAllowedSyncAt: true, lastSyncAt: true,
      },
    }),
  ]);

  if (!company || !link || !access) {
    throw new AppError("Empresa não disponível para este contexto contábil.", "ACCOUNTANT_COMPANY_FORBIDDEN", 403);
  }

  request.company = company;
  request.accountantContext = { office: membership.office, membership, access };
  next();
});

export function requireAccountantWriteAccess(request, _response, next) {
  if (request.accountantContext?.access?.accessLevel !== "FULL") {
    return next(new AppError("Permissão contábil de escrita é necessária.", "ACCOUNTANT_WRITE_FORBIDDEN", 403));
  }
  return next();
}

export function hasAccountantPermission(request, permission) {
  const access = request.accountantContext?.access;
  return access?.accessLevel === "FULL" || (Array.isArray(access?.permissions) && access.permissions.includes(permission));
}
