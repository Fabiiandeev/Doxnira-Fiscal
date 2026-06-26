import { safeParseStorage, setStorage } from "@/lib/safe-storage";

export type OnboardingFiscalStatus = {
  importedXmls: number;
  createdProducts: number;
  createdCustomers: number;
  pendingIssues: number;
  accountantSuggestions: number;
};

const STORAGE_KEY = "ns-onboarding-fiscal";

type OnboardingStoredData = {
  status: OnboardingFiscalStatus;
  steps: { id: number; title: string; description: string; completed: boolean }[];
};

const emptyData: OnboardingStoredData = {
  status: {
    importedXmls: 0,
    createdProducts: 0,
    createdCustomers: 0,
    pendingIssues: 0,
    accountantSuggestions: 0,
  },
  steps: [
    { id: 1, title: "Importar XMLs", description: "Importe os XMLs de notas fiscais da empresa", completed: false },
    { id: 2, title: "Criar produtos", description: "Cadastre produtos a partir dos dados dos XMLs", completed: false },
    { id: 3, title: "Criar clientes", description: "Cadastre os clientes e fornecedores", completed: false },
    { id: 4, title: "Validar cadastros fiscais", description: "Verifique NCMs, CFOPs, CSTs e outras regras", completed: false },
    { id: 5, title: "Configurar estoque fiscal", description: "Lance estoque e configure regras de inventario", completed: false },
    { id: 6, title: "Ativar piloto automatico", description: "Habilite correcoes automaticas e monitoramento", completed: false },
  ],
};

function getStored(): OnboardingStoredData {
  return safeParseStorage<OnboardingStoredData>(STORAGE_KEY, emptyData);
}

function setStored(data: OnboardingStoredData) {
  setStorage(STORAGE_KEY, data);
}

export async function getOnboardingFiscal(): Promise<OnboardingStoredData> {
  await new Promise(res => setTimeout(res, 200));
  return getStored();
}

export async function completeOnboardingStep(stepId: number): Promise<OnboardingStoredData> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const step = data.steps.find(s => s.id === stepId);
  if (step) {
    step.completed = true;
    setStored(data);
  }
  return data;
}

export async function startAIDiagnosis(): Promise<OnboardingStoredData> {
  await new Promise(res => setTimeout(res, 500));
  return getStored();
}

export async function applySafeCorrections(): Promise<OnboardingStoredData> {
  await new Promise(res => setTimeout(res, 300));
  return getStored();
}

export async function getOnboardingFiscalStatus(): Promise<OnboardingFiscalStatus> {
  const data = getStored();
  return data.status;
}

export async function startFiscalDiagnostic(): Promise<OnboardingFiscalStatus> {
  const data = getStored();
  return data.status;
}

export async function applyOnboardingSafeCorrections(): Promise<{ success: boolean; corrected: number }> {
  return { success: true, corrected: 0 };
}

export async function sendOnboardingToAccountant(): Promise<{ success: boolean }> {
  return { success: true };
}
