import { apiFetch } from "@/lib/api";
import type { FinancialOption, Payable, PayableFilters, PayableInput } from "./payable-types";
const base = (companyId: string) => `/companies/${companyId}/financial`;
const clean = (input: PayableInput) => Object.fromEntries(Object.entries(input).filter(([, value]) => value !== "" && value !== undefined));
export const payableService = {
  list: (companyId: string, filters: PayableFilters, signal?: AbortSignal) => { const query = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value && query.set(key, String(value))); return apiFetch<{ data: Payable[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`${base(companyId)}/payables?${query}`, { signal }); },
  detail: (companyId: string, id: string, signal?: AbortSignal) => apiFetch<Payable>(`${base(companyId)}/payables/${id}`, { signal }),
  create: (companyId: string, input: PayableInput) => apiFetch<{ data: Payable[] }>(`${base(companyId)}/payables`, { method: "POST", body: JSON.stringify({ ...clean(input), source: "MANUAL", installments: 1 }) }),
  update: (companyId: string, id: string, input: PayableInput) => apiFetch<Payable>(`${base(companyId)}/payables/${id}`, { method: "PATCH", body: JSON.stringify(clean(input)) }),
  settle: (companyId: string, id: string, body: { amount: string; date: string; financialAccountId?: string | null; method?: string | null }) => apiFetch<Payable>(`${base(companyId)}/payables/${id}/settle`, { method: "POST", body: JSON.stringify(body) }),
  cancel: (companyId: string, id: string, reason: string) => apiFetch<Payable>(`${base(companyId)}/payables/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  reverse: (companyId: string, id: string, reason: string) => apiFetch<Payable>(`${base(companyId)}/payables/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
  reopen: (companyId: string, id: string, reason: string) => apiFetch<Payable>(`${base(companyId)}/payables/${id}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),
  options: async (companyId: string) => { const [categories, centers, accounts] = await Promise.all(["categories", "cost-centers", "accounts"].map(path => apiFetch<{ data: FinancialOption[] }>(`${base(companyId)}/${path}`))); return { categories: categories.data, centers: centers.data, accounts: accounts.data }; },
};

