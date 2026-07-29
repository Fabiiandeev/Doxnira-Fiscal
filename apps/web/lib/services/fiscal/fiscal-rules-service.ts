import { apiFetch, getCompanyId } from "@/lib/api";
export type FiscalRule = { id: string; taxRegime: string; uf: string | null; cfop: string | null; ncm: string | null; taxType: string; rate: number; effectiveFrom: string; effectiveUntil: string | null; creditAllowed: boolean; debitAllowed: boolean };
export type RuleInput = Omit<FiscalRule, "id" | "effectiveUntil">;
const base = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/fiscal-ai/rules`; };
export const fiscalRulesService = {
  list: (search = "", page = 1) => apiFetch<{ data: FiscalRule[]; total: number }>(`${base()}?search=${encodeURIComponent(search)}&page=${page}`),
  create: (data: Partial<RuleInput>) => apiFetch<FiscalRule>(base(), { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RuleInput>) => apiFetch<FiscalRule>(`${base()}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) => apiFetch<FiscalRule>(`${base()}/${id}/toggle`, { method: "POST" }),
  version: (id: string) => apiFetch<FiscalRule>(`${base()}/${id}/version`, { method: "POST", body: "{}" }),
  test: (id: string, data: { cfop?: string; ncm?: string }) => apiFetch<{ matched: boolean; rate: number }>(`${base()}/${id}/test`, { method: "POST", body: JSON.stringify(data) }),
};
