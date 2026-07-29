import { apiFetch, getCompanyId } from "@/lib/api";
import type { FiscalAutopilotSummary, FiscalAutopilotCategory, FiscalIssue } from "@/lib/fiscal-types";

type AutopilotData = {
  summary: FiscalAutopilotSummary; categories: FiscalAutopilotCategory[]; issues: FiscalIssue[];
  recentCorrections: Array<{ id: string; action: string; entity: string; timestamp: string; type: string; status: string }>;
};
let cache: AutopilotData | null = null;
const base = () => {
  const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa.");
  return `/companies/${id}/fiscal-ai`;
};
async function load() { cache = await apiFetch<AutopilotData>(`${base()}/autopilot`); return cache; }
const action = (issueIds: string[], type: string, justification?: string) =>
  apiFetch<{ success: number; failed: number }>(`${base()}/autopilot/actions`, { method: "POST", body: JSON.stringify({ issueIds, action: type, justification }) });

export async function getFiscalAutopilotSummary() { return (await load()).summary; }
export async function getFiscalAutopilotCategories() { return (cache || await load()).categories; }
export async function getFiscalAutopilotIssues(type?: string) { const all = (cache || await load()).issues; return type ? all.filter((i) => i.type === type) : all; }
export function applyAutoFix(ids: string[]) { return action(ids, "AUTO_SAFE"); }
export function applyConfirmation(ids: string[]) { return action(ids, "AUTO_CONFIRM"); }
export function sendToAccountant(ids: string[]) { return action(ids, "ACCOUNTANT_REVIEW"); }
export async function getRecentCorrections() { return (cache || await load()).recentCorrections; }
export async function revalidateAll() { cache = null; return (await load()).summary; }
export function ignoreIssues(ids: string[], justification: string) { return action(ids, "IGNORE", justification); }
