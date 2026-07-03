import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireCompanyAccess } from "../../middlewares/company-access.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { isValidCnpj, normalizeCnpj } from "../../utils/cnpj.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { resolveCnpjData } from "../../services/data-resolver.service.js";
import { writeAudit } from "../audit/audit.service.js";

const companySchema = z.object({
  legalName: z.string().min(3).max(255),
  tradeName: z.string().max(255).optional().nullable(),
  cnpj: z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido."),
  stateRegistration: z.string().max(40).optional().nullable(),
  stateRegistrationStatus: z.string().max(30).optional().nullable(),
  stateRegistrationSource: z.string().max(50).optional().nullable(),
  stateRegistrationFormatted: z.string().max(40).optional().nullable(),
  icmsContributorStatus: z.string().max(30).optional().nullable(),
  uf: z.string().length(2).transform((value) => value.toUpperCase()).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  taxRegime: z.string().max(60).optional().nullable(),
  environment: z.enum(["production", "homologation"]).default("homologation"),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateSchema = companySchema.partial();

const companySelect = {
  id: true,
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
  environment: true,
  status: true,
  nfeLastNsu: true,
  nfeMaxNsu: true,
  nfeNextAllowedSyncAt: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
};

function buildInitialTaxSettings(company) {
  if (!company.uf) return null;
  const taxRegime = [
    "SIMPLES_NACIONAL",
    "LUCRO_PRESUMIDO",
    "LUCRO_REAL",
    "MEI",
    "OUTRO",
    "PENDENTE_CONFIRMACAO",
  ].includes(company.taxRegime) ? company.taxRegime : "PENDENTE_CONFIRMACAO";
  return {
    companyId: company.id,
    taxRegime,
    calculationRegime: "COMPETENCIA",
    uf: company.uf,
    stateRegistration: company.stateRegistration || null,
    mainCnae: null,
    simplesAnnex: null,
    mainActivity: null,
    isIcmsTaxpayer: company.icmsContributorStatus === "ATIVO",
    isIpiTaxpayer: false,
    pisCofinsRegime: taxRegime === "SIMPLES_NACIONAL" ? "SIMPLES" : "PENDENTE_CONFIRMACAO",
    accumulatedRevenue: null,
  };
}

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

export const empresasRouter = Router();
empresasRouter.use(requireAuth);
empresasRouter.get(
  "/buscar-cnpj",
  asyncHandler(async (request, response) => {
    const raw = String(request.query.cnpj || "");

    function sanitizeCnpjInput(input) {
      const s = String(input || "").trim();
      // If input contains a colon (common artifact), prefer the left side
      if (s.includes(":")) {
        const left = s.split(":")[0];
        const leftDigits = normalizeCnpj(left);
        if (leftDigits.length === 14) return leftDigits;
      }

      // Try to find the first occurrence of exactly 14 consecutive digits
      const found = s.match(/(\d{14})/);
      if (found) return found[1];

      // Fallback: strip non-digits and, if longer, take first 14 digits
      const digits = normalizeCnpj(s);
      if (digits.length === 14) return digits;
      if (digits.length > 14) return digits.slice(0, 14);

      // Nothing we can cleanly salvage
      return s;
    }

    const sanitized = sanitizeCnpjInput(raw);

    try {
      const data = await resolveCnpjData(sanitized);
      sendSuccess(response, data);
    } catch (error) {
      if (error instanceof AppError && error.code === "INVALID_CNPJ_FORMAT") {
        throw new AppError(
          "CNPJ inválido.",
          "INVALID_CNPJ_FORMAT",
          400,
          [],
          { field: "cnpj", suggestion: "Remova caracteres extras do CNPJ (ex.: ':1') e tente novamente." },
        );
      }
      throw error;
    }
  }),
);

companiesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const companies = await prisma.company.findMany({
      where: { ownerId: request.user.id, status: { not: "deleted" } },
      select: {
        ...companySelect,
        _count: { select: { fiscalDocuments: true, alerts: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    sendSuccess(response, { data: companies });
  }),
);

companiesRouter.get(
  "/portfolio/dashboard",
  asyncHandler(async (request, response) => {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    const certificateLimit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const companies = await prisma.company.findMany({
      where: { ownerId: request.user.id, status: { not: "deleted" } },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        cnpj: true,
        status: true,
        lastSyncAt: true,
        fiscalDocuments: {
          where: {
            source: { in: ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"] },
            emissionDate: { gte: periodStart, lt: periodEnd },
            isCancelled: false,
          },
          select: {
            operationDirection: true,
            totalAmount: true,
            taxAmount: true,
          },
        },
        alerts: {
          where: { status: { in: ["open", "unread"] } },
          select: { type: true, severity: true },
        },
        monthlyClosings: {
          where: {
            periodYear: now.getFullYear(),
            periodMonth: now.getMonth() + 1,
          },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { legalName: "asc" },
    });
    const [rejectedNotes, expiringCertificates, pendingTypes] = await Promise.all([
      prisma.fiscalDocument.count({
        where: {
          company: { ownerId: request.user.id },
          status: "REJECTED",
          emissionDate: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.digitalCertificate.count({
        where: {
          company: { ownerId: request.user.id },
          status: "active",
          validUntil: { gte: now, lte: certificateLimit },
        },
      }),
      prisma.alert.groupBy({
        by: ["type"],
        where: {
          company: { ownerId: request.user.id },
          status: { in: ["open", "unread"] },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      }),
    ]);
    const rows = companies.map((company) => {
      const revenue = company.fiscalDocuments
        .filter((item) => item.operationDirection === "OUTBOUND")
        .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
      const estimatedTax = company.fiscalDocuments.reduce(
        (sum, item) => sum + Number(item.taxAmount || 0),
        0,
      );
      const closingStatus = company.monthlyClosings[0]?.status || "PENDING";
      return {
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        revenue,
        estimatedTax,
        pendingCount: company.alerts.length,
        closingStatus,
        lastSyncAt: company.lastSyncAt,
      };
    });
    sendSuccess(response, {
      companies: rows,
      kpis: {
        companies: companies.length,
        ready: rows.filter((item) =>
          ["READY_FOR_REVIEW", "APPROVED"].includes(item.closingStatus),
        ).length,
        pending: rows.filter((item) => item.pendingCount > 0).length,
        rejectedNotes,
        expiringCertificates,
        estimatedTax: rows.reduce((sum, item) => sum + item.estimatedTax, 0),
      },
      pendingByType: pendingTypes.map((item) => ({
        type: item.type,
        count: item._count.id,
      })),
    });
  }),
);

companiesRouter.post(
  "/lookup",
  asyncHandler(async (request, response) => {
    const { cnpj } = request.body;
    if (!cnpj) {
      throw new AppError("CNPJ é obrigatório.", "CNPJ_REQUIRED", 400);
    }
    
    const data = await lookupCompanyFiscalData(cnpj);
    sendSuccess(response, data);
  }),
);

companiesRouter.post(
  "/fiscal-config",
  asyncHandler(async (request, response) => {
    const { cnpj, uf, cnaePrincipal, atividadePrincipal, legalName } = request.body;
    if (!cnpj) {
      throw new AppError("CNPJ é obrigatório.", "CNPJ_REQUIRED", 400);
    }
    
    const { generateFiscalConfig, validateFiscalConfig } = await import("../../services/fiscal-config-generator.service.js");
    const config = await generateFiscalConfig({
      cnpj,
      uf,
      cnaePrincipal,
      atividadePrincipal,
      legalName,
    });
    const validation = validateFiscalConfig(config);
    
    sendSuccess(response, { config, validation });
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
    const initialTaxSettings = buildInitialTaxSettings(company);
    if (initialTaxSettings) {
      await prisma.companyTaxSetting.upsert({
        where: { companyId: company.id },
        create: initialTaxSettings,
        update: initialTaxSettings,
      });
    }
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
    const companyCount = await prisma.company.count({
      where: { ownerId: request.user.id, status: { not: "deleted" } },
    });
    if (companyCount <= 1) {
      throw new AppError(
        "Não é possível remover a última empresa. Cadastre outra empresa antes de remover esta.",
        "LAST_COMPANY_DELETE_BLOCKED",
        409,
      );
    }
    await prisma.$transaction([
      prisma.userPreference.updateMany({
        where: { defaultCompanyId: request.company.id },
        data: { defaultCompanyId: null },
      }),
      prisma.company.update({
        where: { id: request.company.id },
        data: { status: "deleted" },
      }),
    ]);
    await writeAudit({
      request,
      action: "COMPANY_DELETED",
      companyId: request.company.id,
      entityType: "Company",
      entityId: request.company.id,
      metadata: { companyId: request.company.id },
    });
    sendSuccess(response, { message: "Empresa removida com sucesso." });
  }),
);
