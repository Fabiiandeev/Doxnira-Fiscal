import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/response.js";

export const requireCompanyAccess = asyncHandler(async (request, _response, next) => {
  const company = await prisma.company.findFirst({
    where: {
      id: request.params.companyId,
      ownerId: request.user.id,
      status: { not: "deleted" },
    },
    select: {
      id: true,
      ownerId: true,
      legalName: true,
      tradeName: true,
      cnpj: true,
      stateRegistration: true,
      stateRegistrationStatus: true,
      stateRegistrationSource: true,
      stateRegistrationFormatted: true,
      icmsContributorStatus: true,
      uf: true,
      city: true,
      taxRegime: true,
      status: true,
      environment: true,
      nfeLastNsu: true,
      nfeMaxNsu: true,
      nfeNextAllowedSyncAt: true,
      lastSyncAt: true,
    },
  });

  if (!company) {
    throw new AppError("Empresa não encontrada.", "COMPANY_NOT_FOUND", 404);
  }

  request.company = company;
  next();
});
