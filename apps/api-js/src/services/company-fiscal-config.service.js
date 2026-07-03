import { prisma } from "../config/prisma.js";

const DEFAULT_ICMS_RATES_BY_UF = {
  AC: 17, AL: 18, AM: 18, AP: 18, BA: 18,
  CE: 18, DF: 18, ES: 17, GO: 17, MA: 18,
  MG: 18, MS: 17, MT: 17, PA: 17, PB: 18,
  PE: 18, PI: 18, PR: 18, RJ: 20, RN: 18,
  RO: 17, RR: 17, RS: 18, SC: 17, SE: 18,
  SP: 18, TO: 18,
};

const DEFAULT_FCP_RATES_BY_UF = {
  AC: 2, AL: 2, AM: 2, AP: 2, BA: 2,
  CE: 2, DF: 2, ES: 2, GO: 2, MA: 2,
  MG: 2, MS: 2, MT: 2, PA: 2, PB: 2,
  PE: 2, PI: 2, PR: 2, RJ: 2, RN: 2,
  RO: 2, RR: 2, RS: 2, SC: 2, SE: 2,
  SP: 2, TO: 2,
};

const DEFAULT_TIPI_TABLE = {
  "39100030": 5, "39269090": 10, "84713012": 0, "85171290": 0,
  "87089990": 15, "22030000": 30, "24022000": 300, "27101259": 0,
  "27111910": 0, "30049099": 0, "34011190": 5, "40111000": 8,
  "48191000": 5, "48201090": 5, "61102000": 10, "84715010": 0,
  "85287290": 10, "94035090": 10, "21069050": 0, "02023000": 5,
};

export async function loadCompanyFiscalConfig(companyId) {
  const settings = await prisma.companyTaxSetting.findUnique({
    where: { companyId },
  });

  if (!settings) {
    return {
      loaded: false,
      reason: "NO_TAX_SETTINGS",
      icmsRatesByUf: DEFAULT_ICMS_RATES_BY_UF,
      fcpRatesByUf: DEFAULT_FCP_RATES_BY_UF,
      tipiTable: DEFAULT_TIPI_TABLE,
      stTable: {},
      companyConfig: null,
      completeness: { fiscalConfigComplete: false, missingFields: ["tax_settings_not_found"] },
    };
  }

  const completeness = computeCompleteness(settings);

  const taxRegime = settings.taxRegime;
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI";
  const isPresumido = taxRegime === "LUCRO_PRESUMIDO";
  const isReal = taxRegime === "LUCRO_REAL";

  const companyConfig = {
    taxRegime,
    isSimples,
    isPresumido,
    isReal,
    crt: settings.crt,
    uf: settings.uf,
    mainCnae: settings.mainCnae,
    secondaryCnaes: settings.secondaryCnaes || [],
    isIcmsTaxpayer: settings.isIcmsTaxpayer,
    isIpiTaxpayer: settings.isIpiTaxpayer,
    icmsContribType: settings.icmsContribType,
    pisCofinsRegime: settings.pisCofinsRegime,
    providesService: settings.providesService,
    sellsMerchandise: settings.sellsMerchandise,
    municipalRegistration: settings.municipalRegistration,
    simplesAnnex: settings.simplesAnnex,
    simplesNominalRate: Number(settings.simplesNominalRate) || null,
    simplesDeductAmount: Number(settings.simplesDeductAmount) || null,
    simplesEffectiveRate: Number(settings.simplesEffectiveRate) || null,
    simplesIcmsPercent: Number(settings.simplesIcmsPercent) || null,
    simplesIssPercent: Number(settings.simplesIssPercent) || null,
    simplesCppPercent: Number(settings.simplesCppPercent) || null,
    simplesFatorR: Number(settings.simplesFatorR) || null,
    simplesRevenue12m: Number(settings.simplesRevenue12m) || null,
    simplesPayroll12m: Number(settings.simplesPayroll12m) || null,
    simplesManualOverride: settings.simplesManualOverride,
    presumidoIrpjBase: Number(settings.presumidoIrpjBase) || null,
    presumidoCsllBase: Number(settings.presumidoCsllBase) || null,
    presumidoPisRate: Number(settings.presumidoPisRate) || null,
    presumidoCofinsRate: Number(settings.presumidoCofinsRate) || null,
    presumidoIssRate: Number(settings.presumidoIssRate) || null,
    presumidoIcmsRate: Number(settings.presumidoIcmsRate) || null,
    presumidoIpiRate: Number(settings.presumidoIpiRate) || null,
    presumidoRatPercent: Number(settings.presumidoRatPercent) || null,
    presumidoThirdParty: Number(settings.presumidoThirdParty) || null,
    presumidoInssPatronal: Number(settings.presumidoInssPatronal) || null,
    presumidoIrpjVencimento: settings.presumidoIrpjVencimento,
    presumidoCsllVencimento: settings.presumidoCsllVencimento,
    realapuracaoPeriod: settings.realapuracaoPeriod,
    realPisRate: Number(settings.realPisRate) || null,
    realCofinsRate: Number(settings.realCofinsRate) || null,
    realCreditAllowed: settings.realCreditAllowed,
    realLalurControl: settings.realLalurControl,
    realPrejuizoControl: settings.realPrejuizoControl,
    realIrpjRate: Number(settings.realIrpjRate) || null,
    realCsllRate: Number(settings.realCsllRate) || null,
    fiscalConfigComplete: settings.fiscalConfigComplete,
  };

  return {
    loaded: true,
    companyConfig,
    completeness,
    icmsRatesByUf: isPresumido && companyConfig.presumidoIcmsRate != null
      ? { ...DEFAULT_ICMS_RATES_BY_UF, [settings.uf]: companyConfig.presumidoIcmsRate }
      : DEFAULT_ICMS_RATES_BY_UF,
    fcpRatesByUf: DEFAULT_FCP_RATES_BY_UF,
    tipiTable: DEFAULT_TIPI_TABLE,
    stTable: {},
  };
}

function computeCompleteness(data) {
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

export { computeCompleteness };
