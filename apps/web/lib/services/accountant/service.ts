import { apiFetch } from "@/lib/api";
import type { AccountantFilters, Paginated, QueueItem, RiskItem } from "./types";
const query = (filters: AccountantFilters = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => v !== undefined && v !== "" && p.set(k, String(v))); return p.toString(); };
export const accountantOfficeApi = {
  dashboard: (officeId: string, filters: AccountantFilters) => apiFetch<Record<string, unknown>>(`/accountant/offices/${officeId}/dashboard?${query(filters)}`),
  risk: (officeId: string, filters: AccountantFilters) => apiFetch<{ items: RiskItem[] }>(`/accountant/offices/${officeId}/risk-ranking?${query(filters)}`),
  queue: (officeId: string, filters: AccountantFilters) => apiFetch<Paginated<QueueItem>>(`/accountant/offices/${officeId}/fiscal-queue?${query(filters)}`),
  value: (officeId: string, filters: AccountantFilters) => apiFetch<Record<string, unknown>>(`/accountant/offices/${officeId}/value-report?${query(filters)}`),
  action: (officeId: string, id: string, action: string, body: Record<string, unknown> = {}) => apiFetch<QueueItem>(`/accountant/offices/${officeId}/fiscal-queue/${id}/${action}`, { method: "POST", body: JSON.stringify(body) }),
};
