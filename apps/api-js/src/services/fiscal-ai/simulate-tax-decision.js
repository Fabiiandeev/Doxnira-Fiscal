import { SIM_MODE, SIM_PHASE, TAX_STATUS } from "./simulation-types.js";
import { validateContextEngine } from "./engines/validate-context-engine.js";
import { operationClassifierEngine } from "./engines/operation-classifier-engine.js";
import { cfopEngine } from "./engines/cfop-engine.js";
import { cstCsosnEngine } from "./engines/cst-csosn-engine.js";
import { incidenceEngine } from "./engines/incidence-engine.js";
import { taxCalculationEngine } from "./engines/tax-calculation-engine.js";
import { nfeRulesValidationEngine } from "./engines/nfe-rules-validation-engine.js";
import { fiscalAuditorEngine } from "./engines/fiscal-auditor-engine.js";

export function simulateTaxDecision(params) {
  const mode = params.mode === "OFFICIAL_NFE" ? SIM_MODE.OFFICIAL_NFE : SIM_MODE.SIMULATION;
  const ctx = {
    ...params,
    mode,
    ncmEntry: params.ncmEntry || {},
    tipi: params.tipi || null,
    mva: params.mva || null,
    cest: params.cest || null,
    fiscalConfig: params.fiscalConfig || null,
  };

  const pipeline = [];

  const validation = validateContextEngine(ctx);
  pipeline.push(validation);

  if (!validation.valid) {
    return {
      mode,
      valid: false,
      errors: validation.errors,
      warnings: validation.warnings,
      pipeline,
      result: null,
      score: 0,
      riskLevel: "CRITICAL",
    };
  }

  const normalizedCtx = validation.context;

  const classification = operationClassifierEngine(normalizedCtx);
  pipeline.push({ phase: classification.phase, ...classification });

  const cfopResult = cfopEngine(classification, normalizedCtx);
  pipeline.push({ phase: cfopResult.phase, selectedCfop: cfopResult.selectedCfop, cfopOptions: cfopResult.cfopOptions, justificativa: cfopResult.justificativa });

  const cstCsosnResult = cstCsosnEngine(classification, cfopResult, normalizedCtx);
  pipeline.push({ phase: cstCsosnResult.phase, tipo: cstCsosnResult.tipo, codigo: cstCsosnResult.codigo, descricao: cstCsosnResult.descricao });

  const incidenceResult = incidenceEngine(classification, cfopResult, cstCsosnResult, normalizedCtx);
  pipeline.push({ phase: incidenceResult.phase, taxKeys: Object.keys(incidenceResult.taxes) });

  const calcResult = taxCalculationEngine(incidenceResult, classification, cfopResult, normalizedCtx);
  pipeline.push({ phase: calcResult.phase, totalTributos: calcResult.totalTributos, percentualCarga: calcResult.percentualCarga });

  const nfeRulesResult = nfeRulesValidationEngine(calcResult, classification, cfopResult, cstCsosnResult, normalizedCtx);
  pipeline.push({
    phase: nfeRulesResult.phase,
    valid: nfeRulesResult.valid,
    blocksCount: nfeRulesResult.blocks.length,
    warningsCount: nfeRulesResult.warnings.length,
  });

  const auditResult = fiscalAuditorEngine(calcResult, nfeRulesResult, classification, cfopResult, normalizedCtx);
  pipeline.push({ phase: auditResult.phase, score: auditResult.score, riskLevel: auditResult.riskLevel });

  const taxLines = {};
  for (const [key, line] of Object.entries(calcResult.taxes)) {
    taxLines[key] = {
      tax: line.tax,
      status: line.status,
      base: line.base,
      rate: line.rate,
      value: line.value,
      rule: line.rule,
      source: line.source,
      confidence: line.confidence,
      explanation: line.explanation,
      pendingFields: line.pendingFields,
    };
  }

  const camposPendentes = [];
  for (const line of Object.values(taxLines)) {
    if (line.pendingFields && line.pendingFields.length > 0) {
      for (const f of line.pendingFields) {
        if (!camposPendentes.includes(f)) camposPendentes.push(f);
      }
    }
  }

  const notasTecnicas = ["NT 2025.002", "NT 2026.001", "NT 2026.004"];

  const result = {
    mode,
    valid: true,
    pipeline,
    context: normalizedCtx,
    classification: {
      isInternal: classification.isInternal,
      isInterestadual: classification.isInterestadual,
      operationType: classification.operationType,
      isSimples: classification.isSimples,
      isRegimeNormal: classification.isRegimeNormal,
      difalApplies: classification.difalApplies,
      isContribuinte: classification.isContribuinte,
      isConsumidorFinal: classification.isConsumidorFinal,
    },
    cfop: {
      options: cfopResult.cfopOptions,
      selectedCfop: cfopResult.selectedCfop,
      selectedCfopInfo: cfopResult.selectedCfopInfo,
      justificativa: cfopResult.justificativa,
      fonte: cfopResult.fonte,
    },
    cstCsosn: {
      tipo: cstCsosnResult.tipo,
      codigo: cstCsosnResult.codigo,
      descricao: cstCsosnResult.descricao,
      aplicacao: cstCsosnResult.aplicacao,
      fonte: cstCsosnResult.fonte,
    },
    taxes: taxLines,
    totals: {
      valorProdutos: +Number(normalizedCtx.valorProduto).toFixed(2),
      totalTributos: calcResult.totalTributos,
      percentualCarga: calcResult.percentualCarga,
      baseIcms: calcResult.baseIcms,
    },
    nfeRules: {
      valid: nfeRulesResult.valid,
      blocks: nfeRulesResult.blocks,
      warnings: nfeRulesResult.warnings,
      infoNotes: nfeRulesResult.infoNotes,
    },
    audit: {
      score: auditResult.score,
      riskLevel: auditResult.riskLevel,
      riskLabel: auditResult.riskLabel,
      issues: auditResult.issues,
      requireHumanConfirm: auditResult.requireHumanConfirm,
      canEmitNfe: auditResult.canEmitNfe,
      auditSummary: auditResult.auditSummary,
    },
    camposPendentes,
    notasTecnicas,
  };

  return result;
}
