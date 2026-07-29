import { apiFetch, getCompanyId } from "@/lib/api";
import type { FiscalScoreData } from "@/lib/fiscal-types";
type ScoreFactor = { id: string; label: string; weight: number; maxPoints: number; earnedPoints: number; status: "OK" | "WARNING" | "ERROR"; details: string; reason?: string };
let last: (FiscalScoreData & { components?: Array<{ id: string; penalty: number }> }) | null = null;
const endpoint = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/fiscal-ai/score`; };
export async function getFiscalScore() { last = await apiFetch<FiscalScoreData>(endpoint()); return last; }
export async function getScoreFactors(): Promise<ScoreFactor[]> {
  const data = last || await getFiscalScore();
  return data.items.map((item) => ({ ...item, details: item.details || "", maxPoints: item.weight * 10, earnedPoints: item.status === "OK" ? item.weight * 10 : item.status === "WARNING" ? item.weight * 5 : 0, reason: item.status === "OK" ? undefined : item.details }));
}
export async function recalculateScore() { last = null; return getFiscalScore(); }
