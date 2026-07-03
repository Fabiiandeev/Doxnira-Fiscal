import { TAX_STATUS, makeTaxLine } from "../simulation-types.js";

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

const DEFAULT_ST_TABLE = {};

const NORTE_NORDESTE = new Set(["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO"]);
const SUL_SUDESTE = new Set(["PR", "RJ", "RS", "SC", "SP"]);

function getInterestadualRate(ufOrigem, ufDestino) {
  const origNNE = NORTE_NORDESTE.has(ufOrigem);
  const destNNE = NORTE_NORDESTE.has(ufDestino);
  if (origNNE && !destNNE) return 7;
  if (!origNNE && destNNE) return 12;
  return 12;
}

function taxCalculationEngine(incidenceResult, classification, cfopResult, ctx) {
  const fiscalConfig = ctx.fiscalConfig || null;
  const icmsRatesByUf = fiscalConfig?.icmsRatesByUf || DEFAULT_ICMS_RATES_BY_UF;
  const fcpRatesByUf = fiscalConfig?.fcpRatesByUf || DEFAULT_FCP_RATES_BY_UF;
  const tipiTable = fiscalConfig?.tipiTable || DEFAULT_TIPI_TABLE;
  const stTable = fiscalConfig?.stTable || DEFAULT_ST_TABLE;
  const companyConfig = fiscalConfig?.companyConfig || null;

  const { taxes } = incidenceResult;
  const { isSimples, isInterestadual, isInternal } = classification;
  const valor = Number(ctx.valorProduto) || 0;
  const frete = Number(ctx.frete) || 0;
  const seguro = Number(ctx.seguro) || 0;
  const desconto = Number(ctx.desconto) || 0;
  const baseIcms = valor + frete + seguro - desconto;

  const calculated = {};

  for (const [key, line] of Object.entries(taxes)) {
    calculated[key] = { ...line };
  }

  if (calculated.icms.status === TAX_STATUS.ZERO_BY_REGIME) {
    calculated.icms.base = baseIcms;
  }

  if (!isSimples && calculated.icms.status === TAX_STATUS.PENDING_RULE && isInternal) {
    const rate = icmsRatesByUf[ctx.ufOrigem];
    if (rate != null) {
      const source = companyConfig?.presumidoIcmsRate != null && ctx.ufOrigem === companyConfig.uf
        ? `Configuração fiscal da empresa — ICMS interno ${ctx.ufOrigem}: ${rate}%`
        : `Tabela ICMS por UF — Convênio ICMS vigente`;
      calculated.icms = makeTaxLine("ICMS", {
        status: TAX_STATUS.CALCULATED,
        base: baseIcms,
        rate: rate / 100,
        value: +(baseIcms * rate / 100).toFixed(2),
        rule: `ICMS interno ${ctx.ufOrigem}: ${rate}% — Convênio ICMS vigente`,
        source,
        confidence: companyConfig?.presumidoIcmsRate != null ? 98 : 95,
        explanation: `Alíquota interna de ${rate}% para ${ctx.ufOrigem}.${companyConfig?.presumidoIcmsRate != null ? " Configurada pela empresa." : ""}`,
        pendingFields: [],
      });
    }
  }

  if (!isSimples && calculated.icms.status === TAX_STATUS.PENDING_RULE && isInterestadual) {
    const rateInterna = icmsRatesByUf[ctx.ufDestino];
    const rateInterestadual = getInterestadualRate(ctx.ufOrigem, ctx.ufDestino);
    if (rateInterestadual != null) {
      calculated.icms = makeTaxLine("ICMS", {
        status: TAX_STATUS.CALCULATED,
        base: baseIcms,
        rate: rateInterestadual / 100,
        value: +(baseIcms * rateInterestadual / 100).toFixed(2),
        rule: `ICMS interestadual ${ctx.ufOrigem}→${ctx.ufDestino}: ${rateInterestadual}% — Resolução Senado Federal 22/2023`,
        source: "Resolução Senado Federal 22/2023",
        confidence: 95,
        explanation: `Alíquota interestadual de ${rateInterestadual}% para ${ctx.ufOrigem}→${ctx.ufDestino}.`,
        pendingFields: [],
      });

      if (classification.difalApplies && rateInterna != null) {
        const difalRate = (rateInterna - rateInterestadual) / 100;
        const difalValue = +(baseIcms * difalRate).toFixed(2);
        calculated.difal = makeTaxLine("DIFAL", {
          status: TAX_STATUS.CALCULATED,
          base: baseIcms,
          rate: difalRate,
          value: difalValue,
          rule: `DIFAL ${ctx.ufOrigem}→${ctx.ufDestino}: (${rateInterna}% - ${rateInterestadual}%) = ${((difalRate) * 100).toFixed(2)}% — EC 87/2015`,
          source: "EC 87/2015 + Resolução Senado 22/2023",
          confidence: 90,
          explanation: `DIFAL para consumidor final não contribuinte: alíquota interna ${rateInterna}% - interestadual ${rateInterestadual}%.`,
          pendingFields: [],
        });
      }
    }
  }

  if (!isSimples && calculated.fcp.status === TAX_STATUS.PENDING_RULE) {
    const fcpRate = fcpRatesByUf[ctx.ufDestino || ctx.ufOrigem];
    if (fcpRate != null) {
      calculated.fcp = makeTaxLine("FCP", {
        status: TAX_STATUS.CALCULATED,
        base: baseIcms,
        rate: fcpRate / 100,
        value: +(baseIcms * fcpRate / 100).toFixed(2),
        rule: `FCP ${(ctx.ufDestino || ctx.ufOrigem)}: ${fcpRate}% — LC 155/2016`,
        source: "LC 155/2016 — FCP por UF",
        confidence: 90,
        explanation: `Alíquota FCP de ${fcpRate}% para ${(ctx.ufDestino || ctx.ufOrigem)}.`,
        pendingFields: [],
      });
    }
  }

  if (calculated.ipi.status === TAX_STATUS.PENDING_RULE) {
    const ipiRate = tipiTable[ctx.ncm];
    if (ipiRate != null) {
      calculated.ipi = makeTaxLine("IPI", {
        status: TAX_STATUS.CALCULATED,
        base: valor,
        rate: ipiRate / 100,
        value: +(valor * ipiRate / 100).toFixed(2),
        rule: `TIPI NCM ${ctx.ncm}: ${ipiRate}% — Decreto 7.660/2012`,
        source: fiscalConfig?.tipiTable ? "Tabela TIPI da configuração fiscal" : "Tabela TIPI — Decreto 7.660/2012",
        confidence: 95,
        explanation: `NCM ${ctx.ncm} na TIPI com alíquota ${ipiRate}%.`,
        pendingFields: [],
      });
    }
  }

  if (calculated.icmsSt.status === TAX_STATUS.PENDING_RULE) {
    const stKey = `${ctx.ncm}_${ctx.ufOrigem}`;
    const stRate = stTable[stKey];
    if (stRate != null) {
      const mva = ctx.mva || 0;
      const baseST = baseIcms * (1 + mva / 100);
      calculated.icmsSt = makeTaxLine("ICMS-ST", {
        status: TAX_STATUS.CALCULATED,
        base: +baseST.toFixed(2),
        rate: stRate / 100,
        value: +(baseST * stRate / 100 - (calculated.icms.value || 0)).toFixed(2),
        rule: `ST NCM ${ctx.ncm} ${ctx.ufOrigem}: ${stRate}% MVA ${mva}%`,
        source: "Tabela ST por NCM/UF",
        confidence: 85,
        explanation: `ICMS-ST: base ${baseST.toFixed(2)} × ${stRate}% - ICMS próprio.`,
        pendingFields: [],
      });
    }
  }

  if (isSimples && calculated.pis?.status === TAX_STATUS.ZERO_BY_REGIME) {
    calculated.pis.base = baseIcms;
  }
  if (isSimples && calculated.cofins?.status === TAX_STATUS.ZERO_BY_REGIME) {
    calculated.cofins.base = baseIcms;
  }

  let totalTributos = 0;
  for (const line of Object.values(calculated)) {
    if (line.status === TAX_STATUS.CALCULATED && line.value != null) {
      totalTributos += line.value;
    }
  }

  return {
    phase: "calculate_taxes",
    taxes: calculated,
    baseIcms,
    totalTributos: +totalTributos.toFixed(2),
    percentualCarga: valor > 0 ? +((totalTributos / valor) * 100).toFixed(2) : 0,
  };
}

export { taxCalculationEngine };
