import { apiFetch, getCompanyId } from "@/lib/api";
import type {
  Benchmark, CommerceIntelligence, FiscalIntelligence, Insight, IntelligenceFilters,
} from "./types";

function companyId() {
  const id = getCompanyId();
  if (!id) throw new Error("Selecione uma empresa para consultar a Inteligência.");
  return id;
}

function query(filters: IntelligenceFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.size ? `?${params}` : "";
}

export const intelligenceService = {
  fiscal: (filters: IntelligenceFilters) =>
    apiFetch<FiscalIntelligence>(`/companies/${companyId()}/intelligence/fiscal${query(filters)}`),
  commerce: (filters: IntelligenceFilters) =>
    apiFetch<CommerceIntelligence>(`/companies/${companyId()}/intelligence/commerce${query(filters)}`),
  insights: async (filters: IntelligenceFilters) =>
    (await apiFetch<{ data: Insight[] }>(`/companies/${companyId()}/intelligence/insights${query(filters)}`)).data,
  decisions: async (filters: IntelligenceFilters) =>
    (await apiFetch<{ data: Insight[] }>(`/companies/${companyId()}/intelligence/decisions${query(filters)}`)).data,
  benchmark: (filters: IntelligenceFilters) =>
    apiFetch<Benchmark>(`/companies/${companyId()}/intelligence/benchmark${query(filters)}`),
  action: (kind: "insights" | "decisions", key: string, body: { action: string; justification?: string; assignee?: string }) =>
    apiFetch(`/companies/${companyId()}/intelligence/${kind}/${encodeURIComponent(key)}/actions`, {
      method: "POST", body: JSON.stringify(body),
    }),
};
