import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const taxRegimes = ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "OUTRO", "PENDENTE_CONFIRMACAO"];
const pisCofinsRegimes = ["CUMULATIVO", "NAO_CUMULATIVO", "SIMPLES", "PENDENTE_CONFIRMACAO"];

const schema = z.object({
  taxRegime: z.enum([
    "SIMPLES_NACIONAL",
    "LUCRO_PRESUMIDO",
    "LUCRO_REAL",
    "MEI",
    "OUTRO",
    "PENDENTE_CONFIRMACAO",
  ]),
  calculationRegime: z.enum(["COMPETENCIA", "CAIXA"]),
  uf: z.string().length(2).transform((value) => value.toUpperCase()),
  stateRegistration: z.string().max(40).optional().nullable(),
  mainCnae: z.string().max(20).optional().nullable(),
  simplesAnnex: z.string().max(20).optional().nullable(),
  mainActivity: z.string().max(255).optional().nullable(),
  isIcmsTaxpayer: z.boolean().default(false),
  isIpiTaxpayer: z.boolean().default(false),
  pisCofinsRegime: z.enum([
    "CUMULATIVO",
    "NAO_CUMULATIVO",
    "SIMPLES",
    "PENDENTE_CONFIRMACAO",
  ]),
  accumulatedRevenue: z.coerce.number().min(0).optional().nullable(),
});

function normalizeTaxRegime(value) {
  return taxRegimes.includes(value) ? value : "PENDENTE_CONFIRMACAO";
}

function normalizePisCofinsRegime(value) {
  return pisCofinsRegimes.includes(value) ? value : "PENDENTE_CONFIRMACAO";
}

function buildRepairData(company) {
  if (!company.uf) {
    throw new AppError("Informe a UF da empresa antes de criar a configuração fiscal.", "FISCAL_CONFIG_MISSING_UF", 422);
  }
  const taxRegime = normalizeTaxRegime(company.taxRegime);
  return {
    taxRegime,
    calculationRegime: "COMPETENCIA",
    uf: String(company.uf).toUpperCase(),
    stateRegistration: company.stateRegistration || null,
    mainCnae: null,
    simplesAnnex: null,
    mainActivity: null,
    isIcmsTaxpayer: company.icmsContributorStatus === "ATIVO",
    isIpiTaxpayer: false,
    pisCofinsRegime: normalizePisCofinsRegime(taxRegime === "SIMPLES_NACIONAL" ? "SIMPLES" : company.taxRegime),
    accumulatedRevenue: null,
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
    const settings = await prisma.companyTaxSetting.upsert({
      where: { companyId: request.company.id },
      create: { companyId: request.company.id, ...buildRepairData(request.company) },
      update: buildRepairData(request.company),
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
  validate(schema),
  asyncHandler(async (request, response) => {
    const settings = await prisma.companyTaxSetting.upsert({
      where: { companyId: request.company.id },
      create: { companyId: request.company.id, ...request.body },
      update: request.body,
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
      metadata: { taxRegime: settings.taxRegime },
    });
    sendSuccess(response, settings);
  }),
);
