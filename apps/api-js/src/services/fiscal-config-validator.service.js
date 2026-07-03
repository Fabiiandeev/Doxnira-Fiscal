const FIELD_LABELS = {
  uf: { label: "UF", instruction: "Informe a UF da empresa no cadastro.", link: "company_uf" },
  taxRegime: { label: "Regime tributário", instruction: "Selecione o regime tributário na Configuração Fiscal.", link: "tax_settings" },
  mainCnae: { label: "CNAE principal", instruction: "Informe o CNAE principal na Configuração Fiscal.", link: "tax_settings" },
  simplesAnnex: { label: "Anexo do Simples", instruction: "Selecione o anexo do Simples Nacional (III, IV ou V).", link: "tax_settings" },
  simplesRevenue12m: { label: "Receita acumulada 12m", instruction: "Informe a receita acumulada dos últimos 12 meses para cálculo do Fator R e faixa do Simples.", link: "tax_settings" },
  presumidoIrpjBase: { label: "Base IRPJ (Presumido)", instruction: "Informe a base de presunção do IRPJ (4%, 8% ou 32%).", link: "tax_settings" },
  presumidoCsllBase: { label: "Base CSLL (Presumido)", instruction: "Informe a base de presunção da CSLL (4%, 12% ou 32%).", link: "tax_settings" },
  presumidoPisRate: { label: "Alíquota PIS (Presumido)", instruction: "Informe a alíquota do PIS (0.65% cumulativo ou não cumulativo).", link: "tax_settings" },
  presumidoCofinsRate: { label: "Alíquota COFINS (Presumido)", instruction: "Informe a alíquota do COFINS (3% cumulativo ou não cumulativo).", link: "tax_settings" },
  realPisRate: { label: "Alíquota PIS (Real)", instruction: "Informe a alíquota do PIS (1.65% não cumulativo).", link: "tax_settings" },
  realCofinsRate: { label: "Alíquota COFINS (Real)", instruction: "Informe a alíquota do COFINS (7.6% não cumulativo).", link: "tax_settings" },
  tax_settings_not_found: { label: "Configuração fiscal", instruction: "Clique em 'Corrigir automaticamente' para criar a configuração fiscal mínima.", link: "tax_settings_repair" },
};

export function validateFiscalConfigForEmission(completeness) {
  const { fiscalConfigComplete, missingFields } = completeness;

  if (fiscalConfigComplete) {
    return {
      canEmit: true,
      blockReason: null,
      missingFields: [],
      fixInstructions: [],
    };
  }

  const fixInstructions = missingFields
    .map((field) => {
      const info = FIELD_LABELS[field];
      if (!info) return null;
      return {
        field,
        label: info.label,
        instruction: info.instruction,
        link: info.link,
      };
    })
    .filter(Boolean);

  return {
    canEmit: false,
    blockReason: `Configuração fiscal incompleta: ${missingFields.map((f) => FIELD_LABELS[f]?.label || f).join(", ")}`,
    missingFields,
    fixInstructions,
  };
}

export function getMissingFieldLabels(missingFields) {
  return missingFields.map((f) => FIELD_LABELS[f]?.label || f);
}
