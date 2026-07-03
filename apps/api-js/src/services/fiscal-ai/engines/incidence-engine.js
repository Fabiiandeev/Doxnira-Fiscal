import { TAX_STATUS, makeTaxLine } from "../simulation-types.js";

export function incidenceEngine(classification, cfopResult, cstCsosnResult, ctx) {
  const { isSimples, isInterestadual, difalApplies, isConsumidorFinal } = classification;
  const { selectedCfop } = cfopResult;
  const csosnOrCst = cstCsosnResult.codigo;

  const taxes = {};

  taxes.icms = (() => {
    if (isSimples) {
      return makeTaxLine("ICMS", {
        status: TAX_STATUS.ZERO_BY_REGIME,
        base: ctx.valorProduto,
        rate: 0,
        value: 0,
        rule: `CRT ${ctx.crt} — Simples Nacional: ICMS próprio = 0 (recolhido via DAS)`,
        source: "Regra FiscalAI — Simples Nacional",
        confidence: 100,
        explanation: "No Simples Nacional o ICMS é recolhido pelo DAS, não há destaque de ICMS próprio na NF-e.",
        pendingFields: [],
      });
    }
    return makeTaxLine("ICMS", {
      status: TAX_STATUS.PENDING_RULE,
      base: ctx.valorProduto,
      rate: null,
      value: null,
      rule: "CRT 3 — Regime Normal: ICMS depende da alíquota interestadual/interna",
      source: "Pendente de tabela de alíquotas ICMS por UF",
      confidence: 50,
      explanation: "Alíquota ICMS depende da UF origem/destino e NCM. Carregue a tabela oficial.",
      pendingFields: ["aliquotaIcms"],
    });
  })();

  taxes.icmsSt = (() => {
    const hasSt = csosnOrCst === "201" || csosnOrCst === "202" || csosnOrCst === "203" || csosnOrCst === "10" || csosnOrCst === "30" || csosnOrCst === "70";
    if (!hasSt) {
      return makeTaxLine("ICMS-ST", {
        status: TAX_STATUS.NOT_APPLICABLE,
        base: null,
        rate: null,
        value: null,
        rule: "CST/CSOSN não indica substituição tributária",
        source: "Regra FiscalAI — CST/CSOSN",
        confidence: 90,
        explanation: "O CST/CSOSN aplicado não prevê cobrança de ICMS-ST nesta operação.",
        pendingFields: [],
      });
    }
    if (!ctx.mva && !ctx.cest) {
      return makeTaxLine("ICMS-ST", {
        status: TAX_STATUS.PENDING_RULE,
        base: null,
        rate: null,
        value: null,
        rule: "ST exige MVA/CEST/protocolo — dados ausentes",
        source: "Regra FiscalAI — ST",
        confidence: 30,
        explanation: "O cálculo de ICMS-ST requer MVA, CEST ou protocolo. Sem dados, não é possível calcular.",
        pendingFields: ["mva", "cest", "protocoloICMS"],
      });
    }
    return makeTaxLine("ICMS-ST", {
      status: TAX_STATUS.PENDING_RULE,
      base: null,
      rate: null,
      value: null,
      rule: "ST com MVA/CEST — cálculo a implementar",
      source: "Regra FiscalAI — ST",
      confidence: 40,
      explanation: "MVA/CEST presentes mas cálculo ST completo ainda não implementado.",
      pendingFields: ["aliquotaInternaDestino"],
    });
  })();

  taxes.fcp = (() => {
    if (isSimples) {
      return makeTaxLine("FCP", {
        status: TAX_STATUS.NOT_APPLICABLE,
        base: null,
        rate: null,
        value: null,
        rule: "Simples Nacional: FCP não se aplica ao optante",
        source: "Regra FiscalAI — FCP/Simples",
        confidence: 95,
        explanation: "Optantes do Simples Nacional não destacam FCP na NF-e.",
        pendingFields: [],
      });
    }
    return makeTaxLine("FCP", {
      status: TAX_STATUS.PENDING_RULE,
      base: null,
      rate: null,
      value: null,
      rule: "FCP depende de tabela por UF/NCM",
      source: "Pendente de tabela FCP",
      confidence: 30,
      explanation: "Alíquota FCP varia por UF e NCM. Carregue tabela oficial.",
      pendingFields: ["aliquotaFcp"],
    });
  })();

  taxes.difal = (() => {
    if (!difalApplies) {
      return makeTaxLine("DIFAL", {
        status: TAX_STATUS.NOT_APPLICABLE,
        base: null,
        rate: null,
        value: null,
        rule: isInterestadual ? "DIFAL não se aplica — destinatário é contribuinte" : "Operação interna — não há DIFAL",
        source: "Regra FiscalAI — DIFAL",
        confidence: 95,
        explanation: isInterestadual ? "DIFAL só se aplica a operações interestaduais para consumidor final não contribuinte." : "Operações internas não geram DIFAL.",
        pendingFields: [],
      });
    }
    return makeTaxLine("DIFAL", {
      status: TAX_STATUS.PENDING_RULE,
      base: ctx.valorProduto,
      rate: null,
      value: null,
      rule: "DIFAL interestadual — depende das alíquotas interna e interestadual",
      source: "Pendente de tabela DIFAL",
      confidence: 40,
      explanation: "DIFAL = (alíq.interna destino - alíq.interestadual) × base. Carregue tabela oficial.",
      pendingFields: ["aliquotaInternaDestino", "aliquotaInterestadual"],
    });
  })();

  taxes.ipi = (() => {
    if (!ctx.ncmEntry?.ipi && !ctx.tipi) {
      return makeTaxLine("IPI", {
        status: TAX_STATUS.PENDING_RULE,
        base: ctx.valorProduto,
        rate: null,
        value: null,
        rule: "IPI depende da TIPI por NCM — tabela não carregada",
        source: "Pendente de tabela TIPI",
        confidence: 30,
        explanation: "Alíquota IPI depende do NCM na TIPI. Carregue tabela oficial.",
        pendingFields: ["aliquotaIpi"],
      });
    }
    const aliquotaIpi = ctx.tipi || ctx.ncmEntry?.ipi || null;
    if (aliquotaIpi == null) {
      return makeTaxLine("IPI", {
        status: TAX_STATUS.PENDING_RULE,
        base: ctx.valorProduto,
        rate: null,
        value: null,
        rule: "IPI: NCM não encontrado na TIPI",
        source: "Pendente de tabela TIPI",
        confidence: 40,
        explanation: "Depende da regra fiscal configurada.",
        pendingFields: ["aliquotaIpi"],
      });
    }
    return makeTaxLine("IPI", {
      status: TAX_STATUS.CALCULATED,
      base: ctx.valorProduto,
      rate: aliquotaIpi / 100,
      value: +(ctx.valorProduto * (aliquotaIpi / 100)).toFixed(2),
      rule: `TIPI NCM ${ctx.ncm} = ${aliquotaIpi}%`,
      source: "Tabela TIPI",
      confidence: 90,
      explanation: `NCM ${ctx.ncm} na TIPI com alíquota ${aliquotaIpi}%.`,
      pendingFields: [],
    });
  })();

  taxes.pis = (() => {
    if (isSimples) {
      return makeTaxLine("PIS", {
        status: TAX_STATUS.ZERO_BY_REGIME,
        base: null,
        rate: null,
        value: null,
        rule: "Simples Nacional: PIS recolhido pelo DAS, não destacado isoladamente na NF-e",
        source: "Regra FiscalAI — PIS/Simples",
        confidence: 100,
        explanation: "No Simples Nacional, PIS é recolhido pelo DAS — sem destaque na NF-e.",
        pendingFields: [],
      });
    }
    const aliquotaPis = ctx.regime === "real" ? 0.0165 : 0.0065;
    const regimeLabel = ctx.regime === "real" ? "Lucro Real (não-cumulativo)" : "Lucro Presumido (cumulativo)";
    return makeTaxLine("PIS", {
      status: TAX_STATUS.CALCULATED,
      base: ctx.valorProduto,
      rate: aliquotaPis,
      value: +(ctx.valorProduto * aliquotaPis).toFixed(2),
      rule: `PIS ${regimeLabel}: ${(aliquotaPis * 100).toFixed(2)}%`,
      source: "Regra FiscalAI — PIS/COFINS",
      confidence: 85,
      explanation: `PIS ${regimeLabel} — alíquota ${(aliquotaPis * 100).toFixed(2)}%.`,
      pendingFields: [],
    });
  })();

  taxes.cofins = (() => {
    if (isSimples) {
      return makeTaxLine("COFINS", {
        status: TAX_STATUS.ZERO_BY_REGIME,
        base: null,
        rate: null,
        value: null,
        rule: "Simples Nacional: COFINS recolhido pelo DAS, não destacado isoladamente na NF-e",
        source: "Regra FiscalAI — COFINS/Simples",
        confidence: 100,
        explanation: "No Simples Nacional, COFINS é recolhido pelo DAS — sem destaque na NF-e.",
        pendingFields: [],
      });
    }
    const aliquotaCofins = ctx.regime === "real" ? 0.076 : 0.03;
    const regimeLabel = ctx.regime === "real" ? "Lucro Real (não-cumulativo)" : "Lucro Presumido (cumulativo)";
    return makeTaxLine("COFINS", {
      status: TAX_STATUS.CALCULATED,
      base: ctx.valorProduto,
      rate: aliquotaCofins,
      value: +(ctx.valorProduto * aliquotaCofins).toFixed(2),
      rule: `COFINS ${regimeLabel}: ${(aliquotaCofins * 100).toFixed(2)}%`,
      source: "Regra FiscalAI — PIS/COFINS",
      confidence: 85,
      explanation: `COFINS ${regimeLabel} — alíquota ${(aliquotaCofins * 100).toFixed(2)}%.`,
      pendingFields: [],
    });
  })();

  taxes.ibs = makeTaxLine("IBS", {
    status: TAX_STATUS.NOT_APPLICABLE,
    base: null,
    rate: null,
    value: null,
    rule: "IBS: Reforma Tributária — tabela de alíquotas IBS não publicada",
    source: "Regra FiscalAI — Reforma Tributária",
    confidence: 50,
    explanation: "Alíquotas IBS ainda não definidas oficialmente. Aguardando regulamentação.",
    pendingFields: ["aliquotaIbs"],
  });

  taxes.cbs = makeTaxLine("CBS", {
    status: TAX_STATUS.NOT_APPLICABLE,
    base: null,
    rate: null,
    value: null,
    rule: "CBS: Reforma Tributária — tabela de alíquotas CBS não publicada",
    source: "Regra FiscalAI — Reforma Tributária",
    confidence: 50,
    explanation: "Alíquotas CBS ainda não definidas oficialmente. Aguardando regulamentação.",
    pendingFields: ["aliquotaCbs"],
  });

  return {
    phase: "determine_incidence",
    taxes,
  };
}
