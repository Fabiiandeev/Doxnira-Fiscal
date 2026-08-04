import { apiFetch } from "@/lib/api";
import type { FinancialAccount, FinancialAccountInput } from "./financial-account-types";
const base = (companyId: string) => `/companies/${companyId}/financial/accounts`;
const clean = (input: FinancialAccountInput) => ({
  name: input.name.trim(),
  type: input.type,
  bank: input.bank || null,
  branch: input.branch || null,
  maskedAccount: input.maskedAccount || null,
  initialBalance: input.initialBalance,
  initialBalanceDate: input.initialBalanceDate ? new Date(input.initialBalanceDate).toISOString() : new Date().toISOString(),
  active: input.active,
});
export const financialAccountService = {
  list: (companyId: string, signal?: AbortSignal) => apiFetch<{ data: FinancialAccount[] }>(base(companyId), { signal }),
  detail: (companyId: string, id: string, signal?: AbortSignal) => apiFetch<FinancialAccount>(`${base(companyId)}/${id}`, { signal }),
  create: (companyId: string, input: FinancialAccountInput) => apiFetch<FinancialAccount>(base(companyId), { method: "POST", body: JSON.stringify(clean(input)) }),
  update: (companyId: string, id: string, input: FinancialAccountInput) => apiFetch<FinancialAccount>(`${base(companyId)}/${id}`, { method: "PATCH", body: JSON.stringify(clean(input)) }),
  activate: (companyId: string, id: string) => apiFetch<FinancialAccount>(`${base(companyId)}/${id}/activate`, { method: "POST", body: JSON.stringify({}) }),
  deactivate: (companyId: string, id: string) => apiFetch<FinancialAccount>(`${base(companyId)}/${id}/deactivate`, { method: "POST", body: JSON.stringify({}) }),
};
