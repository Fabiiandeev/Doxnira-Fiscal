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

const companyTaxSettingsSelect = {
  taxRegime: true,
  calculationRegime: true,
  uf: true,
  stateRegistration: true,
  mainCnae: true,
  secondaryCnaes: true,
  simplesAnnex: true,
  mainActivity: true,
  isIcmsTaxpayer: true,
  isIpiTaxpayer: true,
  pisCofinsRegime: true,
  accumulatedRevenue: true,
  providesService: true,
  sellsMerchandise: true,
  municipalRegistration: true,
  crt: true,
  fiscalConfigComplete: true,
  simplesNominalRate: true,
  simplesFatorR: true,
  simplesRevenue12m: true,
  updatedAt: true,
};

const companyCertificateSelect = {
  id: true,
  status: true,
  validUntil: true,
  holderCnpj: true,
  validatedAt: true,
  updatedAt: true,
};

const companyEnrichedSelect = {
  ...companySelect,
  taxSettings: { select: companyTaxSettingsSelect },
  certificates: {
    where: { status: { not: "deleted" } },
    select: companyCertificateSelect,
    orderBy: { validUntil: "desc" },
    take: 1,
  },
  _count: { select: { fiscalDocuments: true, alerts: true } },
};

const fiscalSettingsFields = new Set([
  "taxRegime", "calculationRegime", "uf", "stateRegistration", "mainCnae",
  "secondaryCnaes", "simplesAnnex", "mainActivity", "isIcmsTaxpayer",
  "isIpiTaxpayer", "pisCofinsRegime", "accumulatedRevenue", "providesService",
  "sellsMerchandise", "municipalRegistration", "crt", "simplesNominalRate",
  "simplesDeductAmount", "simplesEffectiveRate", "simplesIcmsPercent",
  "simplesIssPercent", "simplesCppPercent", "simplesFatorR",
  "simplesRevenue12m", "simplesPayroll12m", "simplesManualOverride",
  "presumidoIrpjBase", "presumidoCsllBase", "presumidoPisRate",
  "presumidoCofinsRate", "presumidoIssRate", "presumidoIcmsRate",
  "presumidoIpiRate", "presumidoRatPercent", "presumidoThirdParty",
  "presumidoInssPatronal", "presumidoIrpjVencimento",
  "presumidoCsllVencimento", "realapuracaoPeriod", "realPisRate",
  "realCofinsRate", "realCreditAllowed", "realLalurControl",
  "realPrejuizoControl", "realIrpjRate", "realCsllRate",
  "fiscalConfigComplete",
]);

const fiscalSettingsPatchSchema = z.object({
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "OUTRO", "PENDENTE_CONFIRMACAO"]).optional(),
  calculationRegime: z.enum(["COMPETENCIA", "CAIXA"]).optional(),
  uf: z.string().length(2).transform((value) => value.toUpperCase()).optional(),
  stateRegistration: z.string().max(40).optional().nullable(),
  mainCnae: z.string().max(20).optional().nullable(),
  secondaryCnaes: z.array(z.string()).optional().nullable(),
  simplesAnnex: z.string().max(20).optional().nullable(),
  mainActivity: z.string().max(255).optional().nullable(),
  isIcmsTaxpayer: z.boolean().optional(),
  isIpiTaxpayer: z.boolean().optional(),
  pisCofinsRegime: z.enum(["CUMULATIVO", "NAO_CUMULATIVO", "SIMPLES", "PENDENTE_CONFIRMACAO"]).optional(),
  accumulatedRevenue: z.coerce.number().min(0).optional().nullable(),
  providesService: z.boolean().optional(),
  sellsMerchandise: z.boolean().optional(),
  municipalRegistration: z.string().max(40).optional().nullable(),
  crt: z.enum(["1", "2", "3", "4"]).optional().nullable(),
}).passthrough();

function decorateCompany(company) {
  const { certificates = [], ...rest } = company;
  return {
    ...rest,
    certificate: certificates[0] || null,
  };
}

function createIssue({ id, title, explanation, impact, field, action, severity }) {
  return { id, title, explanation, impact, field, action, severity };
}

function buildCompanyValidation(company) {
  const settings = company.taxSettings || null;
  const certificate = company.certificate || company.certificates?.[0] || null;
  const issues = [];
  const cnpj = normalizeCnpj(company.cnpj);

  if (!isValidCnpj(cnpj)) {
    issues.push(createIssue({
      id: "invalid-cnpj",
      title: "CNPJ inválido",
      explanation: "O CNPJ informado não passou na validação de dígitos verificadores.",
      impact: "Bloqueia emissão, sincronização fiscal e validações cadastrais.",
      field: "cnpj",
      action: "Corrigir CNPJ da empresa.",
      severity: "error",
    }));
  }
  if (!company.legalName) {
    issues.push(createIssue({
      id: "missing-legal-name",
      title: "Razão social ausente",
      explanation: "A razão social é obrigatória para cadastros fiscais.",
      impact: "Impede a identificação formal da empresa em documentos.",
      field: "legalName",
      action: "Informar a razão social.",
      severity: "error",
    }));
  }
  if (!company.uf) {
    issues.push(createIssue({
      id: "missing-uf",
      title: "UF ausente",
      explanation: "A UF define regras operacionais e ambiente de integração.",
      impact: "Bloqueia configuração fiscal mínima.",
      field: "uf",
      action: "Informar a UF fiscal da empresa.",
      severity: "error",
    }));
  }
  if (!company.city) {
    issues.push(createIssue({
      id: "missing-city",
      title: "Cidade ausente",
      explanation: "A cidade ajuda a validar o domicílio fiscal.",
      impact: "Pode bloquear NFS-e e cadastros municipais.",
      field: "city",
      action: "Informar a cidade da empresa.",
      severity: "warning",
    }));
  }
  if (!company.taxRegime || company.taxRegime === "PENDENTE_CONFIRMACAO") {
    issues.push(createIssue({
      id: "missing-tax-regime",
      title: "Regime tributário não informado",
      explanation: "O regime tributário orienta emissão, fechamento e apuração.",
      impact: "Impede validação fiscal confiável.",
      field: "taxRegime",
      action: "Selecionar o regime tributário.",
      severity: "error",
    }));
  }
  if (!settings?.crt) {
    issues.push(createIssue({
      id: "missing-crt",
      title: "CRT ausente",
      explanation: "O CRT identifica o regime no XML da NF-e.",
      impact: "Pode gerar rejeição de emissão.",
      field: "crt",
      action: "Configurar CRT na aba fiscal.",
      severity: "error",
    }));
  }
  if (!settings?.mainCnae) {
    issues.push(createIssue({
      id: "missing-main-cnae",
      title: "CNAE principal ausente",
      explanation: "O CNAE principal apoia validações fiscais e municipais.",
      impact: "Reduz a confiança da análise fiscal.",
      field: "mainCnae",
      action: "Informar CNAE principal.",
      severity: "warning",
    }));
  }
  if (settings?.isIcmsTaxpayer && !company.stateRegistration && !settings.stateRegistration) {
    issues.push(createIssue({
      id: "missing-state-registration",
      title: "IE ausente",
      explanation: "Empresas contribuintes de ICMS devem ter inscrição estadual.",
      impact: "Pode bloquear emissão de NF-e.",
      field: "stateRegistration",
      action: "Informar a inscrição estadual.",
      severity: "error",
    }));
  }
  if (settings?.providesService && !settings.municipalRegistration) {
    issues.push(createIssue({
      id: "missing-municipal-registration",
      title: "IM ausente para NFS-e",
      explanation: "Prestadores de serviço normalmente precisam de inscrição municipal.",
      impact: "Pode bloquear emissão de NFS-e.",
      field: "municipalRegistration",
      action: "Informar inscrição municipal.",
      severity: "warning",
    }));
  }
  if (!certificate) {
    issues.push(createIssue({
      id: "missing-certificate",
      title: "Certificado digital ausente",
      explanation: "O certificado A1 é necessário para operações fiscais oficiais.",
      impact: "Bloqueia emissão e sincronização real.",
      field: "certificate",
      action: "Gerenciar certificado digital.",
      severity: "error",
    }));
  } else if (certificate.validUntil && new Date(certificate.validUntil) < new Date()) {
    issues.push(createIssue({
      id: "expired-certificate",
      title: "Certificado vencido",
      explanation: "A validade do certificado digital expirou.",
      impact: "Bloqueia operações com SEFAZ.",
      field: "certificate",
      action: "Substituir certificado digital.",
      severity: "error",
    }));
  }
  if ((company.taxRegime === "SIMPLES_NACIONAL" || company.taxRegime === "MEI") && settings && settings.simplesNominalRate == null) {
    issues.push(createIssue({
      id: "missing-simples-percent",
      title: "Percentual do Simples não informado",
      explanation: "A alíquota do Simples orienta simulações e fechamento.",
      impact: "Mantém cálculos em modo pendente de confirmação.",
      field: "simplesNominalRate",
      action: "Informar percentual do Simples.",
      severity: "warning",
    }));
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 16 - warnings * 7);

  return {
    score,
    status: errors > 0 ? "blocked" : warnings > 0 ? "attention" : "ready",
    issues,
    summary: {
      errors,
      warnings,
      readyForClosing: errors === 0 && Boolean(settings?.fiscalConfigComplete),
      fiscalConfigComplete: Boolean(settings?.fiscalConfigComplete),
    },
  };
}

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
      select: companyEnrichedSelect,
      orderBy: { createdAt: "asc" },
    });
    sendSuccess(response, { data: companies.map((company) => {
      const decorated = decorateCompany(company);
      return {
        ...decorated,
        validation: buildCompanyValidation(decorated),
      };
    }) });
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
    
    const data = await resolveCnpjData(cnpj);
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

companiesRouter.get(
  "/:companyId",
  requireCompanyAccess,
  asyncHandler(async (request, response) => {
    const company = await prisma.company.findUnique({
      where: { id: request.company.id },
      select: companyEnrichedSelect,
    });
    const decorated = decorateCompany(company);
    sendSuccess(response, {
      ...decorated,
      validation: buildCompanyValidation(decorated),
    });
  }),
);

companiesRouter.post(
  "/:companyId/validate",
  requireCompanyAccess,
  asyncHandler(async (request, response) => {
    const company = await prisma.company.findUnique({
      where: { id: request.company.id },
      select: companyEnrichedSelect,
    });
    const decorated = decorateCompany(company);
    sendSuccess(response, buildCompanyValidation(decorated));
  }),
);

companiesRouter.patch(
  "/:companyId/fiscal-settings",
  requireCompanyAccess,
  validate(fiscalSettingsPatchSchema),
  asyncHandler(async (request, response) => {
    const current = await prisma.companyTaxSetting.findUnique({
      where: { companyId: request.company.id },
    });
    const safe = {};
    for (const [key, value] of Object.entries(request.body)) {
      if (fiscalSettingsFields.has(key)) safe[key] = value;
    }
    const data = {
      taxRegime: safe.taxRegime || current?.taxRegime || request.company.taxRegime || "PENDENTE_CONFIRMACAO",
      calculationRegime: safe.calculationRegime || current?.calculationRegime || "COMPETENCIA",
      uf: safe.uf || current?.uf || request.company.uf,
      pisCofinsRegime: safe.pisCofinsRegime || current?.pisCofinsRegime || "PENDENTE_CONFIRMACAO",
      isIcmsTaxpayer: safe.isIcmsTaxpayer ?? current?.isIcmsTaxpayer ?? false,
      isIpiTaxpayer: safe.isIpiTaxpayer ?? current?.isIpiTaxpayer ?? false,
      providesService: safe.providesService ?? current?.providesService ?? false,
      sellsMerchandise: safe.sellsMerchandise ?? current?.sellsMerchandise ?? true,
      ...safe,
    };
    if (!data.uf) {
      throw new AppError("Informe a UF antes de salvar configurações fiscais.", "FISCAL_SETTINGS_UF_REQUIRED", 422);
    }
    const settings = await prisma.companyTaxSetting.upsert({
      where: { companyId: request.company.id },
      create: { companyId: request.company.id, ...data },
      update: data,
    });
    await prisma.company.update({
      where: { id: request.company.id },
      data: {
        taxRegime: settings.taxRegime,
        uf: settings.uf,
        stateRegistration: settings.stateRegistration
          ? String(settings.stateRegistration).replace(/\D/g, "")
          : request.company.stateRegistration,
        stateRegistrationFormatted: settings.stateRegistration || request.company.stateRegistrationFormatted,
        icmsContributorStatus: settings.isIcmsTaxpayer ? "ATIVO" : request.company.icmsContributorStatus,
      },
    });
    await writeAudit({
      request,
      action: "company.fiscal_settings_patched",
      companyId: request.company.id,
      entityType: "CompanyTaxSetting",
      entityId: settings.id,
      metadata: { fields: Object.keys(safe) },
    });
    sendSuccess(response, settings);
  }),
);

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
