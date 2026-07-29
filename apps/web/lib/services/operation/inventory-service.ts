import { apiFetch, getCompanyId } from "@/lib/api";
import type { Balance, Count, Filters, Movement, Page, Reservation, Summary, Transfer, Warehouse } from "./inventory-types";

const company = () => { const value = getCompanyId(); if (!value) throw new Error("Selecione uma empresa."); return value; };
const base = () => `/companies/${company()}/operation/inventory`;
const query = (filters: Filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.size ? `?${params}` : "";
};
const get = <T>(path: string, filters?: Filters) => apiFetch<T>(`${base()}${path}${query(filters)}`);
const mutate = <T>(path: string, method: "POST" | "PATCH", body?: unknown) => apiFetch<T>(`${base()}${path}`, { method, body: JSON.stringify(body ?? {}) });
export const inventoryService = {
  summary: () => get<Summary>("/summary"),
  warehouses: (filters?: Filters) => get<Page<Warehouse>>("/warehouses", filters),
  balances: (filters?: Filters) => get<Page<Balance>>("/balances", filters),
  movements: (filters?: Filters) => get<Page<Movement>>("/movements", filters),
  reservations: (filters?: Filters) => get<Page<Reservation>>("/reservations", filters),
  transfers: (filters?: Filters) => get<Page<Transfer>>("/transfers", filters),
  counts: (filters?: Filters) => get<Page<Count>>("/counts", filters),
  count: (id: string) => get<Count>(`/counts/${id}`),
  createWarehouse: (body: unknown) => mutate<Warehouse>("/warehouses", "POST", body),
  adjust: (body: unknown) => mutate<Movement>("/adjustments", "POST", body),
  createReservation: (body: unknown) => mutate<Reservation>("/reservations", "POST", body),
  reservationAction: (id: string, action: string) => mutate<Reservation>(`/reservations/${id}/${action}`, "POST"),
  createTransfer: (body: unknown) => mutate<Transfer>("/transfers", "POST", body),
  transferAction: (id: string, action: string) => mutate<Transfer>(`/transfers/${id}/${action}`, "POST"),
  createCount: (body: unknown) => mutate<Count>("/counts", "POST", body),
  saveCount: (id: string, items: unknown) => mutate<Count>(`/counts/${id}/items`, "PATCH", { items }),
  countAction: (id: string, action: string) => mutate<Count>(`/counts/${id}/${action}`, "POST"),
};
