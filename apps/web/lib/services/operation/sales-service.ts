import { apiFetch, getCompanyId } from "@/lib/api";
import type { Sale, SalesInput, SalesPage } from "./sales-types";
const company = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return id; };
const base = () => `/companies/${company()}/operation/sales`;
export const salesService = {
  list: (query = "") => apiFetch<SalesPage>(`${base()}?${query}`),
  get: (id: string) => apiFetch<Sale>(`${base()}/${id}`),
  create: (body: SalesInput) => apiFetch<Sale>(base(), { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: SalesInput) => apiFetch<Sale>(`${base()}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  action: (id: string, action: string, body: unknown = {}) => apiFetch<Sale>(`${base()}/${id}/${action}`, { method: "POST", body: JSON.stringify(body) }),
};
