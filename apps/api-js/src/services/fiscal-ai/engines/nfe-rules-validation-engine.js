import { TAX_STATUS } from "../simulation-types.js";

export function nfeRulesValidationEngine(calcResult, classification, cfopResult, cstCsosnResult, ctx) {
  const blocks = [];
  const warnings = [];
  const infoNotes = [];

  const { selectedCfop } = cfopResult;
  const { isSimples, isRegimeNormal, isInternal, isInterestadual } = classification;

  if (selectedCfop && isInternal && !selectedCfop.startsWith("5")) {
    blocks.push({
      id: "NFE_CFOP_INTERNA_6",
      field: "cfop",
      severity: "BLOCKED",
      message: `CFOP ${selectedCfop} começa com 6 (interestadual) mas a operação é interna (${ctx.ufOrigem}). Use CFOP 5xxx.`,
    });
  }

  if (selectedCfop && isInterestadual && !selectedCfop.startsWith("6") && !selectedCfop.startsWith("7")) {
    blocks.push({
      id: "NFE_CFOP_INTERESTADUAL_5",
      field: "cfop",
      severity: "BLOCKED",
      message: `CFOP ${selectedCfop} começa com 5 (interna) mas a operação é interestadual (${ctx.ufOrigem}→${ctx.ufDestino}). Use CFOP 6xxx.`,
    });
  }

  if (isSimples && isInternal && calcResult.taxes.icms?.value > 0 && calcResult.taxes.icms?.rate > 0) {
    blocks.push({
      id: "NFE_SIMPLES_ICMS_POSITIVO",
      field: "icms",
      severity: "BLOCKED",
      message: `Simples Nacional (CRT ${ctx.crt}): ICMS próprio deve ser 0 na NF-e. Recolhido via DAS. Valor encontrado: R$${calcResult.taxes.icms.value}`,
    });
  }

  if (isSimples && calcResult.taxes.pis?.value > 0) {
    blocks.push({
      id: "NFE_SIMPLES_PIS_POSITIVO",
      field: "pis",
      severity: "BLOCKED",
      message: `Simples Nacional: PIS não deve ser destacado isoladamente na NF-e. Recolhido via DAS.`,
    });
  }

  if (isSimples && calcResult.taxes.cofins?.value > 0) {
    blocks.push({
      id: "NFE_SIMPLES_COFINS_POSITIVO",
      field: "cofins",
      severity: "BLOCKED",
      message: `Simples Nacional: COFINS não deve ser destacado isoladamente na NF-e. Recolhido via DAS.`,
    });
  }

  if (isSimples && cstCsosnResult.tipo !== "CSOSN") {
    blocks.push({
      id: "NFE_SIMPLES_CST_INSTEAD_CSOSN",
      field: "cstCsosn",
      severity: "BLOCKED",
      message: `Simples Nacional deve usar CSOSN, não CST. Encontrado: ${cstCsosnResult.tipo} ${cstCsosnResult.codigo}.`,
    });
  }

  if (isRegimeNormal && cstCsosnResult.tipo !== "CST") {
    blocks.push({
      id: "NFE_NORMAL_CSOSN_INSTEAD_CST",
      field: "cstCsosn",
      severity: "BLOCKED",
      message: `Regime Normal (CRT 3) deve usar CST, não CSOSN. Encontrado: ${cstCsosnResult.tipo} ${cstCsosnResult.codigo}.`,
    });
  }

  if (calcResult.taxes.icmsSt?.status === TAX_STATUS.CALCULATED && !ctx.cest && !ctx.mva) {
    warnings.push({
      id: "NFE_ST_SEM_CEST_MVA",
      field: "icmsSt",
      severity: "WARNING",
      message: "ICMS-ST calculado, mas CEST/MVA não informados. Verifique se o produto se enquadra em protocolo ST.",
    });
  }

  if (calcResult.taxes.ipi?.status === TAX_STATUS.PENDING_RULE) {
    warnings.push({
      id: "NFE_IPI_SEM_TIPI",
      field: "ipi",
      severity: "INFO",
      message: `IPI pendente — NCM ${ctx.ncm} não encontrado na TIPI. Verifique a regra fiscal.`,
    });
  }

  infoNotes.push({
    id: "NFE_MODE",
    message: ctx.mode === "OFFICIAL_NFE"
      ? "Modo OFICIAL: bloqueios impedem emissão até resolução."
      : "Modo SIMULAÇÃO: resultados são estimativas, não substituem emissão oficial.",
  });

  if (calcResult.taxes.ibs?.status === TAX_STATUS.NOT_APPLICABLE || calcResult.taxes.cbs?.status === TAX_STATUS.NOT_APPLICABLE) {
    infoNotes.push({
      id: "NFE_REFORMA_TRIBUTARIA",
      message: "IBS/CBS: tributos da Reforma Tributária (LC 214/2025) — alíquotas não publicadas. Calculado na emissão conforme vigência.",
    });
  }

  const hasBlocks = blocks.length > 0;

  return {
    phase: "validate_nfe_rules",
    valid: !hasBlocks,
    blocks,
    warnings,
    infoNotes,
    mode: ctx.mode || "SIMULATION",
  };
}
