import { apiFetch } from "@/lib/api";
import type { CompanyTaxSettings } from "@/lib/types";

export interface CnpjLookupResponse {
  empresa: {
    cnpj: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    cidade: string | null;
    uf: string | null;
    cnaePrincipal: {
      codigo: string | null;
      codigoFormatado: string | null;
      descricao: string | null;
    };
  };
  inscricaoEstadual: {
    numero: string | null;
    numeroFormatado: string | null;
    uf: string | null;
    situacao: string;
    fonte: string;
  };
  fiscal: {
    ambiente: "HOMOLOGACAO" | "PRODUCAO";
    regimeApuracao: "COMPETENCIA" | "CAIXA";
    regimeTributario:
      | CompanyTaxSettings["taxRegime"]
      | "PENDENTE_CONFIRMACAO";
    pisCofins:
      | CompanyTaxSettings["pisCofinsRegime"]
      | "PENDENTE_CONFIRMACAO";
    contribuinteICMS: string;
    contribuinteIPI: string;
    anexoSimples: string | null;
    receitaAcumulada12Meses: number | null;
  };
}

export async function lookupCnpj(cnpj: string) {
  return apiFetch<CnpjLookupResponse>(
    `/empresas/buscar-cnpj?cnpj=${encodeURIComponent(cnpj)}`,
  );
}

export function lookupToCompanyForm(data: CnpjLookupResponse) {
  return {
    legalName: data.empresa.razaoSocial || "",
    tradeName: data.empresa.nomeFantasia || "",
    cnpj: data.empresa.cnpj,
    uf: data.empresa.uf?.toUpperCase() || "",
    city: data.empresa.cidade || "",
    stateRegistration: data.inscricaoEstadual.numeroFormatado || "",
    taxRegime: data.fiscal.regimeTributario,
    environment:
      data.fiscal.ambiente === "PRODUCAO"
        ? ("production" as const)
        : ("homologation" as const),
  };
}

export function lookupToCompanyPayload(data: CnpjLookupResponse) {
  return {
    stateRegistration: data.inscricaoEstadual.numero || undefined,
    stateRegistrationFormatted:
      data.inscricaoEstadual.numeroFormatado || undefined,
    stateRegistrationStatus: data.inscricaoEstadual.situacao,
    stateRegistrationSource: data.inscricaoEstadual.fonte,
    icmsContributorStatus: data.fiscal.contribuinteICMS,
    taxRegime: data.fiscal.regimeTributario,
  };
}

export function lookupToTaxSettings(
  data: CnpjLookupResponse,
): CompanyTaxSettings {
  return {
    taxRegime: data.fiscal.regimeTributario,
    calculationRegime: data.fiscal.regimeApuracao,
    uf: data.empresa.uf || "",
    stateRegistration: data.inscricaoEstadual.numeroFormatado,
    mainCnae: data.empresa.cnaePrincipal.codigoFormatado,
    simplesAnnex: data.fiscal.anexoSimples,
    mainActivity: data.empresa.cnaePrincipal.descricao,
    isIcmsTaxpayer: data.fiscal.contribuinteICMS === "ATIVO",
    isIpiTaxpayer: data.fiscal.contribuinteIPI === "ATIVO",
    pisCofinsRegime: data.fiscal.pisCofins,
    accumulatedRevenue: data.fiscal.receitaAcumulada12Meses,
    secondaryCnaes: null,
    icmsContribType: data.fiscal.contribuinteICMS === "ATIVO" ? "SIM" : "NAO",
    providesService: false,
    sellsMerchandise: true,
    municipalRegistration: null,
    crt: data.fiscal.regimeTributario === "SIMPLES_NACIONAL" ? "1" : data.fiscal.regimeTributario === "MEI" ? "2" : "3",
    fiscalConfigComplete: false,
    simplesNominalRate: null,
    simplesDeductAmount: null,
    simplesEffectiveRate: null,
    simplesIcmsPercent: null,
    simplesIssPercent: null,
    simplesCppPercent: null,
    simplesFatorR: null,
    simplesRevenue12m: null,
    simplesPayroll12m: null,
    simplesManualOverride: false,
    presumidoIrpjBase: null,
    presumidoCsllBase: null,
    presumidoPisRate: null,
    presumidoCofinsRate: null,
    presumidoIssRate: null,
    presumidoIcmsRate: null,
    presumidoIpiRate: null,
    presumidoRatPercent: null,
    presumidoThirdParty: null,
    presumidoInssPatronal: null,
    presumidoIrpjVencimento: null,
    presumidoCsllVencimento: null,
    realapuracaoPeriod: null,
    realPisRate: null,
    realCofinsRate: null,
    realCreditAllowed: false,
    realLalurControl: false,
    realPrejuizoControl: false,
    realIrpjRate: null,
    realCsllRate: null,
  };
}
