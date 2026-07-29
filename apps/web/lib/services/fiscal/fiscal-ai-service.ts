import { ApiError, apiFetch, getCompanyId } from "@/lib/api";
import type { FiscalAiProviderStatus, FiscalAiResponse } from "@/lib/fiscal-types";
const endpoint = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/fiscal-ai`; };
export async function getFiscalAiStatus(): Promise<FiscalAiProviderStatus> {
  return apiFetch<FiscalAiProviderStatus>(`${endpoint()}/chat/status`);
}
export async function askFiscalAI(question: string, conversationId?: string): Promise<FiscalAiResponse> {
  const result = await apiFetch<FiscalAiResponse & { configured?: boolean; message?: string }>(`${endpoint()}/chat/messages`, { method: "POST", body: JSON.stringify({ message: question, ...(conversationId ? { conversationId } : {}) }) });
  if (result.configured === false) throw new ApiError(result.message || "Configuração de IA necessária", "AI_CONFIGURATION_REQUIRED", 503);
  return result;
}
export async function getQuickQuestions() { return ["Quais pendências fiscais existem?", "Minha empresa está pronta para fechamento?", "Quais documentos bloqueiam o SPED?", "Existe nota rejeitada?", "O que posso corrigir automaticamente?"]; }
export async function applyAISuggestions(ids: string[]) { return apiFetch<{ success: number; failed: number }>(`${endpoint()}/autopilot/actions`, { method: "POST", body: JSON.stringify({ issueIds: ids, action: "AUTO_CONFIRM" }) }); }
