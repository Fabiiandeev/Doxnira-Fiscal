export type FiscalLearningRule = {
  id: string;
  title: string;
  company: string;
  confidence: "Alta" | "Media" | "Baixa";
  status: "Pendente" | "Aprovada" | "Rejeitada";
};

const rules: FiscalLearningRule[] = [];

export async function getFiscalLearningRules(): Promise<FiscalLearningRule[]> {
  return rules;
}

export async function approveLearningRule(id: string): Promise<FiscalLearningRule | undefined> {
  const rule = rules.find((item) => item.id === id);
  if (rule) rule.status = "Aprovada";
  return rule;
}

export async function rejectLearningRule(id: string): Promise<FiscalLearningRule | undefined> {
  const rule = rules.find((item) => item.id === id);
  if (rule) rule.status = "Rejeitada";
  return rule;
}

export async function applyLearningRule(id: string): Promise<{ success: boolean; id: string }> {
  return { success: true, id };
}
