import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireCompanyAccess } from "../../middlewares/company-access.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const companySchema = z.object({
  legalName: z.string().min(3).max(255),
  tradeName: z.string().max(255).optional().nullable(),
  cnpj: z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido."),
  stateRegistration: z.string().max(40).optional().nullable(),
  uf: z.string().length(2).transform((value) => value.toUpperCase()).optional().nullable(),
  taxRegime: z.string().max(60).optional().nullable(),
  environment: z.enum(["production", "homologation"]).default("production"),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateSchema = companySchema.partial().omit({ cnpj: true });

const companySelect = {
  id: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  stateRegistration: true,
  uf: true,
  taxRegime: true,
  environment: true,
  status: true,
  nfeLastNsu: true,
  nfeMaxNsu: true,
  nfeNextAllowedSyncAt: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
};

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

companiesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companies = await prisma.company.findMany({
      where: { ownerId: request.user.id },
      select: {
        ...companySelect,
        _count: { select: { fiscalDocuments: true, alerts: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    sendSuccess(response, { data: companies });
  }),
);

companiesRouter.post(
  "/",
  validate(companySchema),
  asyncHandler(async (request, response) => {
    const company = await prisma.company.create({
      data: { ...request.body, ownerId: request.user.id },
      select: companySelect,
    });
    await writeAudit({
      request,
      action: "company.created",
      companyId: company.id,
      entityType: "Company",
      entityId: company.id,
    });
    sendSuccess(response, company, 201);
  }),
);

companiesRouter.get("/:companyId", requireCompanyAccess, (request, response) => {
  sendSuccess(response, request.company);
});

companiesRouter.patch(
  "/:companyId",
  requireCompanyAccess,
  validate(updateSchema),
  asyncHandler(async (request, response) => {
    const company = await prisma.company.update({
      where: { id: request.company.id },
      data: request.body,
      select: companySelect,
    });
    await writeAudit({
      request,
      action: "company.updated",
      companyId: company.id,
      entityType: "Company",
      entityId: company.id,
      metadata: { fields: Object.keys(request.body) },
    });
    sendSuccess(response, company);
  }),
);

companiesRouter.delete(
  "/:companyId",
  requireCompanyAccess,
  asyncHandler(async (request, response) => {
    if (request.company.status === "active") {
      throw new AppError(
        "Desative a empresa antes de excluí-la.",
        "ACTIVE_COMPANY_DELETE_BLOCKED",
        409,
      );
    }
    await prisma.company.delete({ where: { id: request.company.id } });
    await writeAudit({
      request,
      action: "company.deleted",
      entityType: "Company",
      metadata: { companyId: request.company.id },
    });
    response.status(204).end();
  }),
);
