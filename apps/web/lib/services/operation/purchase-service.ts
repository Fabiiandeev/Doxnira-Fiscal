import { apiFetch, getCompanyId } from "@/lib/api";
import type { OperationPage, Purchase, PurchaseInput } from "./purchase-types";
const company = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return id; };
const base = () => `/companies/${company()}/operation/purchases`;
export const purchaseService = {
  list: (query = "") => apiFetch<OperationPage<Purchase>>(`${base()}?${query}`),
  get: (id: string) => apiFetch<Purchase>(`${base()}/${id}`),
  create: (body: PurchaseInput) => apiFetch<Purchase>(base(), { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: PurchaseInput) => apiFetch<Purchase>(`${base()}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  action: (id: string, action: string, body: unknown = {}) => apiFetch<Purchase>(`${base()}/${id}/${action}`, { method: "POST", body: JSON.stringify(body) }),
};
