import type { FiscalAiResponse } from "@/lib/fiscal-types";

export async function askFiscalAI(question: string): Promise<FiscalAiResponse> {
  await new Promise(resolve => setTimeout(resolve, 400));

  void question;

  return {
    answer: "Nenhum dado fiscal encontrado para analise. Sincronize documentos ou cadastre informacoes fiscais para gerar diagnostico.",
    suggestions: [],
    actions: [],
    confidence: 0,
    sources: [],
  };
}

export async function getQuickQuestions(): Promise<string[]> {
  return [
    "Quais pendencias fiscais existem?",
    "Minha empresa esta pronta para fechamento?",
    "Quais documentos bloqueiam o SPED?",
    "Existe nota rejeitada?",
    "O que posso corrigir automaticamente?",
  ];
}

export async function applyAISuggestions(suggestionIds: string[]): Promise<{ success: number; failed: number }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: suggestionIds.length, failed: 0 };
}
