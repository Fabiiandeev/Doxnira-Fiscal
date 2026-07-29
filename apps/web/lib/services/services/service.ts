import { apiFetch, getCompanyId } from "@/lib/api";
import type { ServiceCatalog, ServiceInput } from "./types";
const base = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return `/companies/${id}/services`; };
export const servicesService = {
  list: (q: string, page: number, active: string) => apiFetch<{ data: ServiceCatalog[]; total: number; page: number; pageSize: number }>(`${base()}?q=${encodeURIComponent(q)}&page=${page}&active=${active}`),
  get: (id: string) => apiFetch<ServiceCatalog>(`${base()}/${id}`),
  create: (data: ServiceInput) => apiFetch<ServiceCatalog>(base(), { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ServiceInput>) => apiFetch<ServiceCatalog>(`${base()}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string, active: boolean) => apiFetch<ServiceCatalog>(`${base()}/${id}/status`, { method: "PATCH", body: JSON.stringify({ active }) }),
  remove: (id: string) => apiFetch<void>(`${base()}/${id}`, { method: "DELETE" }),
};
