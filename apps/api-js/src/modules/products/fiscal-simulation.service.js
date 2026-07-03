const ICMS_RATES_BY_UF = {
  AC: 17, AL: 18, AM: 18, AP: 18, BA: 18,
  CE: 18, DF: 18, ES: 17, GO: 17, MA: 18,
  MG: 18, MS: 17, MT: 17, PA: 17, PB: 18,
  PE: 18, PI: 18, PR: 18, RJ: 20, RN: 18,
  RO: 17, RR: 17, RS: 18, SC: 17, SE: 18,
  SP: 18, TO: 18,
};

const FCP_RATES_BY_UF = {
  AC: 2, AL: 2, AM: 2, AP: 2, BA: 2,
  CE: 2, DF: 2, ES: 2, GO: 2, MA: 2,
  MG: 2, MS: 2, MT: 2, PA: 2, PB: 2,
  PE: 2, PI: 2, PR: 2, RJ: 2, RN: 2,
  RO: 2, RR: 2, RS: 2, SC: 2, SE: 2,
  SP: 2, TO: 2,
};

const TIPI_TABLE = {
  "39100030": 5,
  "39269090": 10,
  "84713012": 0,
  "85171290": 0,
  "87089990": 15,
  "22030000": 30,
  "24022000": 300,
  "27101259": 0,
  "27111910": 0,
  "30049099": 0,
  "34011190": 5,
  "40111000": 8,
  "48191000": 5,
  "48201090": 5,
  "61102000": 10,
  "84715010": 0,
  "85287290": 10,
  "94035090": 10,
  "21069050": 0,
  "02023000": 5,
};

const ST_TABLE = {};

const PIS_COFINS_RATES = {
  simples: { pis: null, cofins: null },
  presumido: { pis: 0.65, cofins: 3.0 },
  real: { pis: 1.65, cofins: 7.6 },
};

const PIS_COFINS_SOURCES = {
  simples: {
    pis: "Calculado na apuração do Simples Nacional — não incide isoladamente",
    cofins: "Calculado na apuração do Simples Nacional — não incide isoladamente",
  },
  presumido: {
    pis: "PIS cumulativo — Lucro Presumido (LC 7/1970) — Rate: 0,65%",
    cofins: "COFINS cumulativo — Lucro Presumido (LC 70/1991) — Rate: 3,00%",
  },
  real: {
    pis: "PIS não cumulativo — Lucro Real (LC 10.637/2002) — Rate: 1,65%",
    cofins: "COFINS não cumulativo — Lucro Real (LC 10.833/2003) — Rate: 7,60%",
  },
};

const INTERESTADUAL_RATES = {
  "S-sul": 12,
  "N-ne-2": 7,
  "N-ne-1": 12,
};

function getInterestadualRate(ufOrigem, ufDestino) {
  const norteNordeste = new Set(["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","RN","RO","RR","SE","TO"]);
  const sulSudeste = new Set(["PR","RJ","RS","SC","SP"]);

  const origNNE = norteNordeste.has(ufOrigem);
  const destNNE = norteNordeste.has(ufDestino);

  if (origNNE && !destNNE) return 7;
  if (!origNNE && destNNE) return 12;
  return 12;
}

function getCfopOptions(ufOrigem, ufDestino, tipoOperacao, finalidade) {
  const isInternal = ufOrigem === ufDestino;
  const prefix = isInternal ? "5" : "6";

  if (finalidade === "devolucao") {
    return [
      {
        codigo: `${prefix}201`,
        descricao: "Devolução de venda de produção do estabelecimento",
        aplicacao: "Produto fabricado pelo emitente — devolução",
        recomendado: tipoOperacao === "producao_propria",
        motivo: `Devolução ${isInternal ? "interna" : "interestadual"} de produção própria`,
      },
      {
        codigo: `${prefix}202`,
        descricao: "Devolução de venda de mercadoria adquirida ou recebida de terceiros",
        aplicacao: "Produto de terceiros — devolução",
        recomendado: tipoOperacao === "revenda",
        motivo: `Devolução ${isInternal ? "interna" : "interestadual"} de mercadoria de terceiros`,
      },
    ];
  }

  if (finalidade === "complementar") {
    return [
      {
        codigo: `${prefix}151`,
        descricao: "Venda de produção do estabelecimento, sujeita ao ICMS e à incidência do IPI",
        aplicacao: "Venda complementar de produção própria",
        recomendado: tipoOperacao === "producao_propria",
        motivo: `Venda complementar ${isInternal ? "interna" : "interestadual"} — produção própria`,
      },
      {
        codigo: `${prefix}152`,
        descricao: "Venda de mercadoria adquirida ou recebida de terceiros, sujeita ao ICMS e à incidência do IPI",
        aplicacao: "Venda complementar de revenda",
        recomendado: tipoOperacao === "revenda",
        motivo: `Venda complementar ${isInternal ? "interna" : "interestadual"} — revenda`,
      },
    ];
  }

  return [
    {
      codigo: `${prefix}101`,
      descricao: "Venda de produção do estabelecimento",
      aplicacao: "Produto fabricado/industrializado pelo emitente",
      recomendado: tipoOperacao === "producao_propria",
      motivo: `Operação ${isInternal ? "interna" : "interestadual"} — venda de produção própria`,
    },
    {
      codigo: `${prefix}102`,
      descricao: "Venda de mercadoria adquirida ou recebida de terceiros",
      aplicacao: "Produto adquirido para revenda",
      recomendado: tipoOperacao === "revenda",
      motivo: `Operação ${isInternal ? "interna" : "interestadual"} — venda de mercadoria de terceiros`,
    },
  ];
}

function getCstCsosn(crt, regime, selectedCfop) {
  if (crt === "1" || regime === "simples") {
    return {
      tipo: "CSOSN",
      codigo: "102",
      descricao: "Tributada pelo Simples Nacional sem permissão de crédito",
      fonte: "Tabela CSOSN — Simples Nacional — CFOP de saída",
    };
  }
  return {
    tipo: "CST",
    codigo: "00",
    descricao: "Tributada integralmente",
    fonte: "Tabela CST ICMS — Lucro Presumido/Real — CFOP de saída",
  };
}

function getIcmsRate(uf, ncmEntry, isInternal) {
  if (!ICMS_RATES_BY_UF[uf]) {
    return { rate: null, loaded: false, source: "pending", message: "Depende da regra fiscal configurada" };
  }
  return { rate: ICMS_RATES_BY_UF[uf], loaded: true, source: "Tabela ICMS por UF — Convênio ICMS vigente" };
}

function getInterestadualIcmsRate(ufOrigem, ufDestino) {
  const rate = getInterestadualRate(ufOrigem, ufDestino);
  return { rate, loaded: true, source: "Resolução Senado Federal 22/2023 — Alíquotas interestaduais" };
}

function getFcpRate(uf, ncmEntry) {
  if (!FCP_RATES_BY_UF[uf] || !ncmEntry.fcp) {
    return { rate: null, loaded: false, source: "pending", message: "FCP não se aplica ou sem regra configurada" };
  }
  return { rate: FCP_RATES_BY_UF[uf], loaded: true, source: "LC 155/2016 — FCP por UF" };
}

function getIpiRate(ncm) {
  if (TIPI_TABLE[ncm] != null) {
    return { rate: TIPI_TABLE[ncm], loaded: true, source: "Tabela TIPI — Decreto 7.660/2012" };
  }
  return { rate: null, loaded: false, source: "pending", message: "Depende da regra fiscal configurada" };
}

function getPisCofinsRates(regime, isMonofasico) {
  const rates = PIS_COFINS_RATES[regime] || PIS_COFINS_RATES.presumido;
  const sources = PIS_COFINS_SOURCES[regime] || PIS_COFINS_SOURCES.presumido;

  if (isMonofasico) {
    return {
      pis: { rate: null, value: null, loaded: false, source: "pending", message: "PIS monofásico — já recolhido na fabricação" },
      cofins: { rate: null, value: null, loaded: false, source: "pending", message: "COFINS monofásico — já recolhido na fabricação" },
    };
  }

  if (rates.pis == null) {
    return {
      pis: { rate: null, value: null, loaded: false, source: sources.pis, message: "Calculado na apuração do Simples Nacional" },
      cofins: { rate: null, value: null, loaded: false, source: sources.cofins, message: "Calculado na apuração do Simples Nacional" },
    };
  }

  return {
    pis: { rate: rates.pis, loaded: true, source: sources.pis },
    cofins: { rate: rates.cofins, loaded: true, source: sources.cofins },
  };
}

function getStInfo(ncmEntry, uf) {
  const key = `${ncmEntry.ncm}_${uf}`;
  const stRate = ST_TABLE[key];
  if (ncmEntry.st && stRate == null) {
    return { applies: null, rate: null, loaded: false, source: "pending", message: "Possível ST — pendente de tabela ST por NCM/CEST/UF" };
  }
  if (ncmEntry.st && stRate != null) {
    return { applies: true, rate: stRate, loaded: true, source: "Tabela ST por NCM/UF", message: null };
  }
  return { applies: false, rate: null, loaded: true, source: "Tabela NCM local", message: "NCM sem ST na tabela base" };
}

export function simulateFiscalOperation(params) {
  const {
    ncm,
    ncmEntry,
    ufOrigem,
    ufDestino,
    crt,
    regime,
    tipoOperacao,
    consumidorFinal,
    contribuinteIcms,
    finalidade,
    valorProduto,
    frete,
    seguro,
    desconto,
    selectedCfop,
  } = params;

  const valor = Number(valorProduto) || 0;
  const freteVal = Number(frete) || 0;
  const seguroVal = Number(seguro) || 0;
  const descontoVal = Number(desconto) || 0;
  const baseIcms = valor + freteVal + seguroVal - descontoVal;
  const isInternal = ufOrigem === ufDestino;

  const cfopOptions = getCfopOptions(ufOrigem, ufDestino, tipoOperacao, finalidade);
  const cstCsosn = getCstCsosn(crt, regime, selectedCfop);
  const icmsInfo = getIcmsRate(ufOrigem, ncmEntry, isInternal);
  const interestadualInfo = !isInternal ? getInterestadualIcmsRate(ufOrigem, ufDestino) : null;
  const fcpInfo = getFcpRate(ufOrigem, ncmEntry);
  const ipiInfo = getIpiRate(ncm);
  const pisCofins = getPisCofinsRates(regime, ncmEntry.monofasico);
  const stInfo = getStInfo(ncmEntry, ufOrigem);

  const origemLabel = {
    0: "0 — Nacional",
    1: "1 — Importação direta",
    2: "2 — Adquirida no mercado interno",
    3: "3 — Nacional, importação > 40%",
    4: "4 — Nacional, PPB",
    5: "5 — Nacional, importação <= 40%",
    6: "6 — Importação direta, sem similar",
    7: "7 — Adquirida interno, sem similar",
    8: "8 — Nacional, importação > 70%",
  };

  const hasCfopSelected = !!selectedCfop;
  const canCalculate = hasCfopSelected && icmsInfo.loaded;

  const icmsValue = canCalculate && icmsInfo.rate != null
    ? +(baseIcms * icmsInfo.rate / 100).toFixed(2)
    : null;

  const fcpValue = canCalculate && fcpInfo.rate != null
    ? +(baseIcms * fcpInfo.rate / 100).toFixed(2)
    : null;

  const icmsResult = {
    cfopOptions,
    selectedCfop: selectedCfop || null,
    cst: cstCsosn,
    origem: ncmEntry.origemMercadoria != null
      ? { codigo: ncmEntry.origemMercadoria, descricao: origemLabel[ncmEntry.origemMercadoria] || `Código ${ncmEntry.origemMercadoria}` }
      : { codigo: null, descricao: "Não definida" },
    aliquota: icmsInfo.rate != null && canCalculate
      ? { rate: icmsInfo.rate, value: icmsValue, loaded: icmsInfo.loaded, source: icmsInfo.source }
      : { rate: null, value: null, loaded: false, source: icmsInfo.source || "pending", message: !hasCfopSelected ? "Selecione o CFOP para simular" : (icmsInfo.message || "Depende da regra fiscal configurada") },
    aliquotaInterestadual: interestadualInfo
      ? { rate: interestadualInfo.rate, loaded: interestadualInfo.loaded, source: interestadualInfo.source }
      : null,
    baseCalculo: baseIcms,
    reducaoBc: { rate: 0, source: "Sem redução de base — tributação integral" },
    fcp: fcpInfo.rate != null && canCalculate
      ? { rate: fcpInfo.rate, value: fcpValue, loaded: fcpInfo.loaded, source: fcpInfo.source }
      : { rate: null, value: null, loaded: false, source: fcpInfo.source || "pending", message: fcpInfo.message || "FCP não aplicável" },
    difal: !isInternal && consumidorFinal
      ? { applies: true, loaded: true, message: "DIFAL aplicável — consumidor final, operação interestadual", source: "EC 87/2015" }
      : { applies: false, loaded: true, message: isInternal ? "Não se aplica para operação interna" : "Não se aplica — não consumidor final", source: "EC 87/2015" },
    icmsSt: stInfo,
  };

  const pisValue = pisCofins.pis.rate != null && canCalculate
    ? +(baseIcms * pisCofins.pis.rate / 100).toFixed(2)
    : null;
  const cofinsValue = pisCofins.cofins.rate != null && canCalculate
    ? +(baseIcms * pisCofins.cofins.rate / 100).toFixed(2)
    : null;
  const ipiValue = ipiInfo.rate != null && canCalculate
    ? +(valor * ipiInfo.rate / 100).toFixed(2)
    : null;

  const tributosFederais = {
    pis: pisCofins.pis.rate != null && canCalculate
      ? { rate: pisCofins.pis.rate, value: pisValue, loaded: true, source: pisCofins.pis.source }
      : { rate: null, value: null, loaded: pisCofins.pis.loaded ?? false, source: pisCofins.pis.source || "pending", message: pisCofins.pis.message || "Depende da regra fiscal configurada" },
    cofins: pisCofins.cofins.rate != null && canCalculate
      ? { rate: pisCofins.cofins.rate, value: cofinsValue, loaded: true, source: pisCofins.cofins.source }
      : { rate: null, value: null, loaded: pisCofins.cofins.loaded ?? false, source: pisCofins.cofins.source || "pending", message: pisCofins.cofins.message || "Depende da regra fiscal configurada" },
    ipi: ipiInfo.rate != null && canCalculate
      ? { rate: ipiInfo.rate, value: ipiValue, loaded: true, source: ipiInfo.source }
      : { rate: null, value: null, loaded: false, source: ipiInfo.source || "pending", message: ipiInfo.message || "Depende da regra fiscal configurada" },
  };

  const reformaTributaria = {
    ibs: { rate: null, value: null, loaded: false, source: "pending", message: "Pendente de tabela RTC" },
    cbs: { rate: null, value: null, loaded: false, source: "pending", message: "Pendente de tabela RTC" },
    impostoSeletivo: { rate: null, value: null, loaded: false, source: "pending", message: "Pendente de tabela RTC" },
    cClassTrib: { codigo: null, descricao: "Pendente de tabela RTC", source: "pending" },
    cstIbsCbs: { codigo: null, descricao: "Pendente de tabela RTC", source: "pending" },
    baseIbsCbs: null,
    aliquotaIbs: { rate: null, loaded: false, source: "pending", message: "Pendente de tabela RTC" },
    aliquotaCbs: { rate: null, loaded: false, source: "pending", message: "Pendente de tabela RTC" },
    valorIbs: { value: null, source: "pending", message: "Pendente de tabela RTC" },
    valorCbs: { value: null, source: "pending", message: "Pendente de tabela RTC" },
    splitPayment: { applies: null, message: "Split Payment configurado na emissão conforme vigência", source: "LC 214/2025" },
    creditoFinanceiro: { applies: null, message: "Crédito financeiro calculado na emissão", source: "LC 214/2025" },
    dataVigencia: "Fase transitória conforme LC 214/2025",
    compatibilidadeNt: "Conforme NT 2025.002 e vigência da Reforma Tributária",
  };

  const tributosAtuais = [
    icmsResult.aliquota.value || 0,
    icmsResult.fcp.value || 0,
    tributosFederais.pis.value || 0,
    tributosFederais.cofins.value || 0,
    tributosFederais.ipi.value || 0,
  ].reduce((sum, v) => sum + v, 0);

  const resultado = {
    valorProdutos: +valor.toFixed(2),
    totalTributosAtuais: canCalculate ? +tributosAtuais.toFixed(2) : 0,
    percentualCargaAtual: canCalculate && valor > 0 ? +((tributosAtuais / valor) * 100).toFixed(2) : 0,
    reforma: { totalEstimado: null, message: "Tributos da Reforma calculados na emissão conforme vigência" },
    totalEfetivo: canCalculate ? +tributosAtuais.toFixed(2) : 0,
    baseLegal: "Convênio ICMS, Ajuste SINIEF, TIPI (Decreto 7.660/2012), Tabela NCM, LC 155/2016 (FCP), LC 214/2025 (IBS/CBS/IS)",
    observacoes: canCalculate
      ? "Simulação estimativa. Tributação definitiva calculada na emissão da NF-e pelo FiscalAI. IBS/CBS/IS separados conforme vigência."
      : "Simulação parcial. Selecione o CFOP e verifique as regras fiscais para cálculo completo.",
    riscoFiscal: !hasCfopSelected ? "Pendente" : canCalculate && tributosAtuais > 0 ? "Baixo" : "Pendente",
    confiancaIa: !hasCfopSelected ? 0 : icmsInfo.loaded && ipiInfo.loaded ? 98 : icmsInfo.loaded ? 60 : 30,
    camposUsados: hasCfopSelected
      ? ["NCM", "UF Origem", "UF Destino", "CRT", "Regime", "Tipo Operação", "CFOP", "Valor"].filter(() => true)
      : ["NCM", "UF Origem", "UF Destino", "CRT", "Regime", "Tipo Operação", "Valor"].filter(() => true),
    camposPendentes: [
      !hasCfopSelected ? "CFOP (selecione para simular)" : null,
      !icmsInfo.loaded ? "Alíquota ICMS" : null,
      !ipiInfo.loaded ? "TIPI" : null,
      stInfo.source === "pending" ? "Tabela ST" : null,
      tipoOperacao === "desconhecido" ? "Tipo de operação (produção própria ou revenda)" : null,
      !pisCofins.pis.rate && regime !== "simples" && !ncmEntry.monofasico ? "PIS/COFINS" : null,
    ].filter(Boolean),
    exigirConfirmacaoHumano: !hasCfopSelected || tipoOperacao === "desconhecido",
    notasTecnicas: ["NT 2025.002", "NT 2026.001", "NT 2026.004"],
  };

  const score = Math.round(
    (hasCfopSelected ? 20 : 0) +
    (icmsInfo.loaded ? 25 : 0) +
    (ncmEntry.origemMercadoria != null ? 10 : 0) +
    (ipiInfo.loaded ? 15 : 0) +
    10 +
    (tipoOperacao !== "desconhecido" ? 10 : 0) +
    (pisCofins.pis.rate != null ? 10 : 0)
  );

  return {
    icms: icmsResult,
    tributosFederais,
    reformaTributaria,
    resultado,
    score,
  };
}
