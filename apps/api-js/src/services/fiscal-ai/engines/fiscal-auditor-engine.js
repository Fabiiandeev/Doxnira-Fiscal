import { TAX_STATUS } from "../simulation-types.js";

export function fiscalAuditorEngine(calcResult, nfeRulesResult, classification, cfopResult, ctx) {
  const issues = [];
  let score = 100;

  if (nfeRulesResult.blocks.length > 0) {
    for (const block of nfeRulesResult.blocks) {
      issues.push({ ...block, auditorImpact: -20 });
      score -= 20;
    }
  }

  if (nfeRulesResult.warnings.length > 0) {
    for (const w of nfeRulesResult.warnings) {
      issues.push({ ...w, auditorImpact: -5 });
      score -= 5;
    }
  }

  const pendingCount = Object.values(calcResult.taxes).filter(
    t => t.status === TAX_STATUS.PENDING_RULE
  ).length;
  if (pendingCount > 0) {
    score -= pendingCount * 3;
    issues.push({
      id: "AUDIT_PENDING_RULES",
      field: "simulation",
      severity: "INFO",
      message: `${pendingCount} tributo(s) com status PENDING_RULE — tabelas oficiais não carregadas.`,
      auditorImpact: -pendingCount * 3,
    });
  }

  if (!cfopResult.selectedCfop) {
    score -= 15;
    issues.push({
      id: "AUDIT_NO_CFOP",
      field: "cfop",
      severity: "WARNING",
      message: "Nenhum CFOP selecionado — simulação parcial.",
      auditorImpact: -15,
    });
  }

  if (classification.tipoOperacao === "desconhecido") {
    score -= 10;
    issues.push({
      id: "AUDIT_TIPO_OPERACAO",
      field: "tipoOperacao",
      severity: "INFO",
      message: "Tipo de operação não definido — CFOP pode não ser o ideal.",
      auditorImpact: -10,
    });
  }

  score = Math.max(0, Math.min(100, score));

  const riskLevel = score >= 80 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 25 ? "HIGH" : "CRITICAL";
  const riskLabel = { LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto", CRITICAL: "Crítico" }[riskLevel];

  const requireHumanConfirm = score < 50
    || nfeRulesResult.blocks.length > 0
    || classification.tipoOperacao === "desconhecido";

  return {
    phase: "audit_result",
    score,
    riskLevel,
    riskLabel,
    issues,
    requireHumanConfirm,
    canEmitNfe: nfeRulesResult.blocks.length === 0 && score >= 50,
    auditSummary: score >= 80
      ? "Simulação com alta confiança. Verifique dados antes da emissão."
      : score >= 50
        ? "Simulação parcial — revise os campos pendentes antes da emissão."
        : "Simulação com bloqueios/crítica — não emitir NF-e até resolver.",
  };
}
