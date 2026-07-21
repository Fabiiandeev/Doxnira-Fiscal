import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/response.js";

const companySelect = {
  id: true,
  ownerId: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  status: true,
};

export const requireSubscriptionCompanyContext = asyncHandler(async (request, _response, next) => {
  const requestedCompanyId = request.get("x-company-id")?.trim() || null;

  if (requestedCompanyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: requestedCompanyId,
        ownerId: request.user.id,
        status: { not: "deleted" },
      },
      select: companySelect,
    });

    if (!company) {
      throw new AppError(
        "Você não possui acesso à empresa selecionada.",
        "COMPANY_ACCESS_DENIED",
        403,
      );
    }

    request.company = company;
    return next();
  }

  const companies = await prisma.company.findMany({
    where: { ownerId: request.user.id, status: { not: "deleted" } },
    select: companySelect,
    orderBy: { createdAt: "asc" },
    take: 2,
  });

  if (companies.length !== 1) {
    throw new AppError(
      "Selecione uma empresa para consultar a assinatura.",
      "COMPANY_CONTEXT_REQUIRED",
      400,
    );
  }

  request.company = companies[0];
  return next();
});
