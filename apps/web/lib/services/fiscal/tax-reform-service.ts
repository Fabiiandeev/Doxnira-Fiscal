export type TaxReformImpact = {
  companiesAnalyzed: number;
  impactedProducts: number;
  impactedServices: number;
  pendingRules: number;
  highRiskCompanies: number;
};

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 300);
  });
}

export async function getTaxReformImpact(): Promise<TaxReformImpact> {
  await delay();
  return {
    companiesAnalyzed: 0,
    impactedProducts: 0,
    impactedServices: 0,
    pendingRules: 0,
    highRiskCompanies: 0,
  };
}

export async function applyTaxReformRule(ruleId: string): Promise<{ success: boolean; ruleId: string }> {
  await delay();
  return { success: true, ruleId };
}

export async function generateAdequationPlan(): Promise<{ success: boolean; planId: string }> {
  await delay();
  return { success: true, planId: "tax-reform-plan-001" };
}
