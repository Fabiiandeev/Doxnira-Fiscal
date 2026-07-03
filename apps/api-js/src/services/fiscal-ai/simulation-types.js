export const TAX_STATUS = {
  CALCULATED: "CALCULATED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  PENDING_RULE: "PENDING_RULE",
  BLOCKED: "BLOCKED",
  ZERO_BY_REGIME: "ZERO_BY_REGIME",
};

export const SIM_MODE = {
  SIMULATION: "SIMULATION",
  OFFICIAL_NFE: "OFFICIAL_NFE",
};

export const SIM_PHASE = {
  VALIDATE_CONTEXT: "validate_context",
  CLASSIFY_OPERATION: "classify_operation",
  DETERMINE_CFOP: "determine_cfop",
  DETERMINE_CST_CSOSN: "determine_cst_csosn",
  DETERMINE_INCIDENCE: "determine_incidence",
  CALCULATE_TAXES: "calculate_taxes",
  VALIDATE_NFE_RULES: "validate_nfe_rules",
  AUDIT_RESULT: "audit_result",
};

export const CRT_MAP = {
  1: { label: "1 — Simples Nacional", regime: "simples", usesCsosn: true },
  2: { label: "2 — Simples Nacional com ST", regime: "simples", usesCsosn: true },
  3: { label: "3 — Regime Normal", regime: "presumido", usesCsosn: false },
  4: { label: "4 — MEI", regime: "simples", usesCsosn: true },
};

export function makeTaxLine(tax, overrides = {}) {
  return {
    tax,
    status: overrides.status ?? TAX_STATUS.PENDING_RULE,
    base: overrides.base ?? null,
    rate: overrides.rate ?? null,
    value: overrides.value ?? null,
    rule: overrides.rule ?? "",
    source: overrides.source ?? "",
    confidence: overrides.confidence ?? 0,
    explanation: overrides.explanation ?? "",
    pendingFields: overrides.pendingFields ?? [],
  };
}
