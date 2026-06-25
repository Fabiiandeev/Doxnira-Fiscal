export type TaxReformImpact = {
  companiesAnalyzed: number;
  impactedProducts: number;
  impactedServices: number;
  pendingRules: number;
  highRiskCompanies: number;
};

const impact: TaxReformImpact = {
  companiesAnalyzed: 28,
  impactedProducts: 1284,
  impactedServices: 342,
  pendingRules: 76,
  highRiskCompanies: 6,
};

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 300);
  });
}

export async function getTaxReformImpact(): Promise<TaxReformImpact> {
  await delay();
  return impact;
}

export async function applyTaxReformRule(ruleId: string): Promise<{ success: boolean; ruleId: string }> {
  await delay();
  return { success: true, ruleId };
}

export async function generateAdequationPlan(): Promise<{ success: boolean; planId: string }> {
  await delay();
  return { success: true, planId: "tax-reform-plan-001" };
}
