import {
  checkSimpleNacional,
  searchStateRegistration,
  resolveSimpleNacionalAnexo,
  classifyIPI,
} from "./cnpj-lookup.service.js";

export async function generateFiscalConfig(empresa) {
  const config = {
    ambienteFiscal: "HOMOLOGACAO",
    regimeApuracao: "COMPETENCIA",
    uf: empresa.uf || null,
    cnaePrincipal: empresa.cnaePrincipal || null,
    atividadePrincipal: empresa.atividadePrincipal || null,
    regimeTributario: null,
    pisCofins: null,
    anexoSimples: null,
    inscricaoEstadual: null,
    contribuinteICMS: null,
    contribuinteIPI: null,
    receitaAcumulada12Meses: null,
    simplesNacional: false,
    icmsContribType: null,
    providesService: false,
    sellsMerchandise: true,
    municipalRegistration: null,
    crt: null,
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
    fiscalConfigComplete: false,
    pendencias: [],
  };

  if (!empresa.cnpj) {
    config.pendencias.push({
      campo: "cnpj",
      tipo: "BLOQUEANTE",
      motivo: "CNPJ não fornecido",
      impacto: "Impossível validar configuração fiscal",
    });
    return config;
  }

  const isSimples = await checkSimpleNacional(empresa.cnpj);
  config.simplesNacional = isSimples === true;

  if (config.simplesNacional) {
    config.regimeTributario = "SIMPLES_NACIONAL";
    config.pisCofins = "SIMPLES";
    config.crt = "1";
    config.anexoSimples = resolveSimpleNacionalAnexo(empresa.cnaePrincipal);

    if (!config.anexoSimples && empresa.cnaePrincipal) {
      config.pendencias.push({
        campo: "anexoSimples",
        tipo: "ALERTA",
        motivo: "Anexo Simples não resolvido automaticamente",
        impacto: "Necessária confirmação para cálculo de impostos",
      });
    }

    config.pendencias.push({
      campo: "simplesRevenue12m",
      tipo: "ALERTA",
      motivo: "Receita acumulada 12 meses não informada",
      impacto: "Necessária para cálculo correto de faixas Simples e Fator R",
    });
  } else {
    config.regimeTributario = "PENDENTE_CONFIRMACAO";
    config.pisCofins = "PENDENTE_CONFIRMACAO";
    config.pendencias.push({
      campo: "regimeTributario",
      tipo: "BLOQUEANTE",
      motivo: "Empresa não consta como optante do Simples Nacional",
      impacto: "Impossível processar documentos sem confirmação do regime",
    });
    config.pendencias.push({
      campo: "pisCofins",
      tipo: "BLOQUEANTE",
      motivo: "Regime tributário não definido",
      impacto: "Cálculo de PIS/COFINS pendente",
    });
    config.pendencias.push({
      campo: "presumidoPisRate",
      tipo: "ALERTA",
      motivo: "Alíquota PIS não configurada para Presumido/Real",
      impacto: "Necessária para cálculo de PIS",
    });
  }

  if (!empresa.uf) {
    config.pendencias.push({
      campo: "uf",
      tipo: "BLOQUEANTE",
      motivo: "UF não informada",
      impacto: "Impossível validar inscrição estadual",
    });
  } else {
    const ieResult = await searchStateRegistration(empresa.cnpj, empresa.uf);
    if (ieResult.found && ieResult.inscricaoEstadual) {
      config.inscricaoEstadual = ieResult.inscricaoEstadual;
      config.contribuinteICMS = ieResult.ativo ? "ATIVO" : "INATIVO";
      config.icmsContribType = ieResult.ativo ? "SIM" : "NAO";
    } else {
      config.inscricaoEstadual = null;
      config.contribuinteICMS = "PENDENTE_SINTEGRA";
      config.icmsContribType = "NAO";
      config.pendencias.push({
        campo: "inscricaoEstadual",
        tipo: "BLOQUEANTE",
        motivo: "Inscrição Estadual não validada no SINTEGRA/SEFAZ",
        impacto: "Impossível autorizar documentos ICMS sem IE",
      });
    }
  }

  config.contribuinteIPI = classifyIPI(empresa.cnaePrincipal);
  if (config.contribuinteIPI === "PROVAVEL") {
    config.pendencias.push({
      campo: "contribuinteIPI",
      tipo: "ALERTA",
      motivo: "Atividade industrial detectada",
      impacto: "Incidência de IPI deve ser confirmada por produto/NCM",
    });
  }

  return config;
}

export function validateFiscalConfig(config) {
  const bloqueantes = config.pendencias
    ?.filter((p) => p.tipo === "BLOQUEANTE") || [];

  return {
    valido: bloqueantes.length === 0,
    bloqueantes,
    alertas: config.pendencias?.filter((p) => p.tipo === "ALERTA") || [],
  };
}
