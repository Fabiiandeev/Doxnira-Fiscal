import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const taxRegimes = ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "OUTRO", "PENDENTE_CONFIRMACAO"];
const pisCofinsRegimes = ["CUMULATIVO", "NAO_CUMULATIVO", "SIMPLES", "PENDENTE_CONFIRMACAO"];
const icmsContribTypes = ["SIM", "NAO", "ISENTO"];
const crtValues = ["1", "2", "3", "4"];
const apuracaoPeriods = ["MENSAL", "TRIMESTRAL"];
const vencimentoValues = ["ULTIMO_DIA_UTIL", "DIA_15", "DIA_20", "DIA_25", "DIA_30"];

const decimalOrNull = z.coerce.number().min(0).optional().nullable();
const stringMax = (max) => z.string().max(max).optional().nullable();

const baseSchema = z.object({
  taxRegime: z.enum(taxRegimes),
  calculationRegime: z.enum(["COMPETENCIA", "CAIXA"]),
  uf: z.string().length(2).transform((v) => v.toUpperCase()),
  stateRegistration: stringMax(40),
  mainCnae: stringMax(20),
  simplesAnnex: stringMax(20),
  mainActivity: stringMax(255),
  isIcmsTaxpayer: z.boolean().default(false),
  isIpiTaxpayer: z.boolean().default(false),
  pisCofinsRegime: z.enum(pisCofinsRegimes),
  accumulatedRevenue: decimalOrNull,
});

const extendedSchema = baseSchema.extend({
  secondaryCnaes: z.array(z.string()).optional().nullable(),
  icmsContribType: z.enum(icmsContribTypes).optional().nullable(),
  providesService: z.boolean().default(false),
  sellsMerchandise: z.boolean().default(true),
  municipalRegistration: stringMax(40),
  crt: z.enum(crtValues).optional().nullable(),

  simplesNominalRate: decimalOrNull,
  simplesDeductAmount: decimalOrNull,
  simplesEffectiveRate: decimalOrNull,
  simplesIcmsPercent: decimalOrNull,
  simplesIssPercent: decimalOrNull,
  simplesCppPercent: decimalOrNull,
  simplesFatorR: decimalOrNull,
  simplesRevenue12m: decimalOrNull,
  simplesPayroll12m: decimalOrNull,
  simplesManualOverride: z.boolean().default(false),

  presumidoIrpjBase: decimalOrNull,
  presumidoCsllBase: decimalOrNull,
  presumidoPisRate: decimalOrNull,
  presumidoCofinsRate: decimalOrNull,
  presumidoIssRate: decimalOrNull,
  presumidoIcmsRate: decimalOrNull,
  presumidoIpiRate: decimalOrNull,
  presumidoRatPercent: decimalOrNull,
  presumidoThirdParty: decimalOrNull,
  presumidoInssPatronal: decimalOrNull,
  presumidoIrpjVencimento: z.enum(vencimentoValues).optional().nullable(),
  presumidoCsllVencimento: z.enum(vencimentoValues).optional().nullable(),

  realapuracaoPeriod: z.enum(apuracaoPeriods).optional().nullable(),
  realPisRate: decimalOrNull,
  realCofinsRate: decimalOrNull,
  realCreditAllowed: z.boolean().default(false),
  realLalurControl: z.boolean().default(false),
  realPrejuizoControl: z.boolean().default(false),
  realIrpjRate: decimalOrNull,
  realCsllRate: decimalOrNull,
});

const PRISMA_FIELDS = new Set([
  "taxRegime", "calculationRegime", "uf", "stateRegistration", "mainCnae",
  "simplesAnnex", "mainActivity", "isIcmsTaxpayer", "isIpiTaxpayer",
  "pisCofinsRegime", "accumulatedRevenue", "secondaryCnaes", "icmsContribType",
  "providesService", "sellsMerchandise", "municipalRegistration", "crt",
  "simplesNominalRate", "simplesDeductAmount", "simplesEffectiveRate",
  "simplesIcmsPercent", "simplesIssPercent", "simplesCppPercent",
  "simplesFatorR", "simplesRevenue12m", "simplesPayroll12m", "simplesManualOverride",
  "presumidoIrpjBase", "presumidoCsllBase", "presumidoPisRate", "presumidoCofinsRate",
  "presumidoIssRate", "presumidoIcmsRate", "presumidoIpiRate", "presumidoRatPercent",
  "presumidoThirdParty", "presumidoInssPatronal", "presumidoIrpjVencimento",
  "presumidoCsllVencimento", "realapuracaoPeriod", "realPisRate", "realCofinsRate",
  "realCreditAllowed", "realLalurControl", "realPrejuizoControl",
  "realIrpjRate", "realCsllRate", "fiscalConfigComplete",
]);

function stripUnknownFields(payload) {
  const safe = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PRISMA_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

function normalizeTaxRegime(value) {
  return taxRegimes.includes(value) ? value : "PENDENTE_CONFIRMACAO";
}

function normalizePisCofinsRegime(value) {
  return pisCofinsRegimes.includes(value) ? value : "PENDENTE_CONFIRMACAO";
}

function computeCrt(taxRegime) {
  switch (taxRegime) {
    case "SIMPLES_NACIONAL": return "1";
    case "LUCRO_PRESUMIDO": return "3";
    case "LUCRO_REAL": return "3";
    case "MEI": return "2";
    default: return null;
  }
}

function computeSimplesDerived(data) {
  if (data.taxRegime !== "SIMPLES_NACIONAL" && data.taxRegime !== "MEI") {
    return {};
  }
  const revenue = Number(data.simplesRevenue12m) || 0;
  const payroll = Number(data.simplesPayroll12m) || 0;
  const derived = {};
  if (revenue > 0 && payroll > 0) {
    derived.simplesFatorR = +((payroll / revenue) * 100).toFixed(2);
  }
  if (data.simplesNominalRate != null && data.simplesDeductAmount != null && revenue > 0) {
    const effective = (data.simplesNominalRate * revenue - data.simplesDeductAmount) / revenue;
    derived.simplesEffectiveRate = +(effective).toFixed(2);
  }
  return derived;
}

function computeFiscalConfigComplete(data) {
  const missing = [];
  if (!data.uf) missing.push("uf");
  if (!data.taxRegime || data.taxRegime === "PENDENTE_CONFIRMACAO") missing.push("taxRegime");
  if (!data.mainCnae) missing.push("mainCnae");
  if (data.taxRegime === "SIMPLES_NACIONAL" || data.taxRegime === "MEI") {
    if (!data.simplesAnnex) missing.push("simplesAnnex");
    if (data.simplesRevenue12m == null) missing.push("simplesRevenue12m");
  }
  if (data.taxRegime === "LUCRO_PRESUMIDO") {
    if (data.presumidoIrpjBase == null) missing.push("presumidoIrpjBase");
    if (data.presumidoCsllBase == null) missing.push("presumidoCsllBase");
    if (data.presumidoPisRate == null) missing.push("presumidoPisRate");
    if (data.presumidoCofinsRate == null) missing.push("presumidoCofinsRate");
  }
  if (data.taxRegime === "LUCRO_REAL") {
    if (data.realPisRate == null) missing.push("realPisRate");
    if (data.realCofinsRate == null) missing.push("realCofinsRate");
  }
  return { fiscalConfigComplete: missing.length === 0, missingFields: missing };
}

function buildRepairData(company) {
  if (!company.uf) {
    throw new AppError("Informe a UF da empresa antes de criar a configuração fiscal.", "FISCAL_CONFIG_MISSING_UF", 422);
  }
  const taxRegime = normalizeTaxRegime(company.taxRegime);
  const crt = computeCrt(taxRegime);
  return {
    taxRegime,
    calculationRegime: "COMPETENCIA",
    uf: String(company.uf).toUpperCase(),
    stateRegistration: company.stateRegistration || null,
    mainCnae: null,
    secondaryCnaes: null,
    simplesAnnex: null,
    mainActivity: null,
    isIcmsTaxpayer: company.icmsContributorStatus === "ATIVO",
    isIpiTaxpayer: false,
    icmsContribType: company.icmsContributorStatus === "ATIVO" ? "SIM" : "NAO",
    pisCofinsRegime: normalizePisCofinsRegime(taxRegime === "SIMPLES_NACIONAL" ? "SIMPLES" : company.taxRegime),
    accumulatedRevenue: null,
    providesService: false,
    sellsMerchandise: true,
    municipalRegistration: null,
    crt,
    fiscalConfigComplete: false,
  };
}

export const taxSettingsRouter = Router({ mergeParams: true });

taxSettingsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const settings = await prisma.companyTaxSetting.findUnique({
      where: { companyId: request.company.id },
    });
    sendSuccess(response, settings);
  }),
);

taxSettingsRouter.post(
  "/repair",
  asyncHandler(async (request, response) => {
    const data = buildRepairData(request.company);
    const settings = await prisma.companyTaxSetting.upsert({
      where: { companyId: request.company.id },
      create: { companyId: request.company.id, ...data },
      update: data,
    });
    const stateRegistrationFormatted = settings.stateRegistration || null;
    const stateRegistration = stateRegistrationFormatted
      ? String(stateRegistrationFormatted).replace(/\D/g, "")
      : null;
    await prisma.company.update({
      where: { id: request.company.id },
      data: {
        taxRegime: settings.taxRegime,
        uf: settings.uf,
        stateRegistration,
        stateRegistrationFormatted,
        stateRegistrationStatus: stateRegistration
          ? request.company.stateRegistrationStatus || "PENDENTE_VALIDACAO_SEFAZ"
          : null,
        stateRegistrationSource: stateRegistration
          ? request.company.stateRegistrationSource || "FORMULARIO_CONFIGURACAO_FISCAL"
          : null,
        icmsContributorStatus: stateRegistration
          ? request.company.icmsContributorStatus || "PENDENTE_VALIDACAO_SEFAZ"
          : null,
      },
    });
    await writeAudit({
      request,
      action: "company.tax_settings_repaired",
      companyId: request.company.id,
      entityType: "CompanyTaxSetting",
      entityId: settings.id,
      metadata: { taxRegime: settings.taxRegime },
    });
    sendSuccess(response, settings);
  }),
);

taxSettingsRouter.put(
  "/",
  validate(extendedSchema),
  asyncHandler(async (request, response) => {
    let data = stripUnknownFields(request.body);

    if (!data.crt && data.taxRegime) {
      data.crt = computeCrt(data.taxRegime);
    }

    const simplesDerived = computeSimplesDerived(data);
    data = { ...data, ...simplesDerived };

    const completeness = computeFiscalConfigComplete(data);
    data.fiscalConfigComplete = completeness.fiscalConfigComplete;

    const settings = await prisma.companyTaxSetting.upsert({
      where: { companyId: request.company.id },
      create: { companyId: request.company.id, ...data },
      update: data,
    });
    const stateRegistrationFormatted = settings.stateRegistration || null;
    const stateRegistration = stateRegistrationFormatted
      ? String(stateRegistrationFormatted).replace(/\D/g, "")
      : null;
    const preserveAutomaticLookup =
      Boolean(stateRegistration) &&
      request.company.stateRegistration === stateRegistration &&
      request.company.stateRegistrationSource === "BUSCA_AUTOMATICA";
    await prisma.company.update({
      where: { id: request.company.id },
      data: {
        taxRegime: settings.taxRegime,
        uf: settings.uf,
        stateRegistration,
        stateRegistrationFormatted,
        stateRegistrationStatus: preserveAutomaticLookup
          ? request.company.stateRegistrationStatus
          : stateRegistration
            ? "PENDENTE_VALIDACAO_SEFAZ"
            : null,
        stateRegistrationSource: preserveAutomaticLookup
          ? request.company.stateRegistrationSource
          : stateRegistration
            ? "FORMULARIO_CONFIGURACAO_FISCAL"
            : null,
        icmsContributorStatus: preserveAutomaticLookup
          ? request.company.icmsContributorStatus
          : settings.isIcmsTaxpayer
            ? "ATIVO"
            : stateRegistration
              ? "PENDENTE_VALIDACAO_SEFAZ"
              : null,
      },
    });
    await writeAudit({
      request,
      action: "company.tax_settings_updated",
      companyId: request.company.id,
      entityType: "CompanyTaxSetting",
      entityId: settings.id,
      metadata: {
        taxRegime: settings.taxRegime,
        fiscalConfigComplete: settings.fiscalConfigComplete,
        missingFields: completeness.fiscalConfigComplete ? [] : completeness.missingFields,
      },
    });
    sendSuccess(response, { ...settings, _completeness: completeness });
  }),
);

taxSettingsRouter.get(
  "/completeness",
  asyncHandler(async (request, response) => {
    const settings = await prisma.companyTaxSetting.findUnique({
      where: { companyId: request.company.id },
    });
    if (!settings) {
      sendSuccess(response, { fiscalConfigComplete: false, missingFields: ["tax_settings_not_found"] });
      return;
    }
    const completeness = computeFiscalConfigComplete(settings);
    sendSuccess(response, completeness);
  }),
);
