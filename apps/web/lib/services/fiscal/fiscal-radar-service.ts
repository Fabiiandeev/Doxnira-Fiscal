import { apiFetch, getCompanyId } from "@/lib/api";
import type { FiscalRadarAlert } from "@/lib/fiscal-types";
const base = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/fiscal-ai`; };
export async function getFiscalRadarAlerts(filters?: { riskLevel?: string; category?: string }) {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  return (await apiFetch<{ data: FiscalRadarAlert[] }>(`${base()}/radar${query ? `?${query}` : ""}`)).data;
}
async function act(id: string, action: string, justification?: string) {
  await apiFetch(`${base()}/autopilot/actions`, { method: "POST", body: JSON.stringify({ issueIds: [id], action, justification }) });
  return (await getFiscalRadarAlerts()).find((item) => item.id === id) || null;
}
export const autoFixAlert = (id: string) => act(id, "AUTO_SAFE");
export const applyAISuggestion = (id: string) => act(id, "AUTO_CONFIRM");
export const sendToAccountant = (id: string) => act(id, "ACCOUNTANT_REVIEW");
export const requestClient = (id: string) => act(id, "MANUAL_GUIDED");
