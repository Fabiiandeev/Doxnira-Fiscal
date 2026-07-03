import { apiFetch, getCompanyId } from "@/lib/api";
import type { IntelligentClient } from "@/lib/client-types";
import type { NfeActionResponse, NfeDetailActionResponse, NfeDetailResponse, NfeFilters, NfeListResponse } from "@/lib/nfe-types";
import type { Cfop, Product } from "@/lib/product-types";

function getActiveCompanyId() {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return companyId;
}

export async function listNfe(input: {
  page: number;
  limit: number;
  filters: NfeFilters;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<NfeListResponse> {
  const companyId = getActiveCompanyId();
  const params = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit),
    sortBy: input.sortBy || "updatedAt",
    sortOrder: input.sortOrder || "desc",
  });

  Object.entries(input.filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });

  return apiFetch(`/companies/${companyId}/nfe?${params}`);
}

export async function createNfeDraft(): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe`, { method: "POST" });
}

export async function getNfe(nfeId: string): Promise<NfeDetailResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}`);
}

export async function updateNfe(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteNfeDraft(nfeId: string): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}`, { method: "DELETE" });
}

export async function validateNfe(nfeId: string): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/validate`, { method: "POST" });
}

export async function transmitNfe(nfeId: string): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/transmit`, { method: "POST" });
}

export async function getNfeStatus(nfeId: string) {
  const companyId = getActiveCompanyId();
  return apiFetch<{
    id: string;
    status: string;
    canTransmit: boolean;
    protocol: string | null;
    message: string | null;
    updatedAt: string;
  }>(`/companies/${companyId}/nfe/${nfeId}/status`);
}

export async function duplicateNfe(nfeId: string): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/duplicate`, { method: "POST" });
}

export async function addNfeItem(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateNfeItem(
  nfeId: string,
  itemId: string,
  payload: Record<string, unknown>,
): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteNfeItem(nfeId: string, itemId: string): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/items/${itemId}`, { method: "DELETE" });
}

export async function searchNfeCfops(input: {
  q?: string;
  operationType?: string;
  destinationType?: string;
  limit?: number;
} = {}): Promise<Cfop[]> {
  const companyId = getActiveCompanyId();
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.operationType) params.set("operationType", input.operationType);
  if (input.destinationType) params.set("destinationType", input.destinationType);
  if (input.limit) params.set("limit", String(input.limit));
  const res = await apiFetch<{ data: Cfop[] }>(`/companies/${companyId}/cfops/search?${params.toString()}`);
  return res.data;
}

export async function searchNfeClients(q = "", limit = 25): Promise<IntelligentClient[]> {
  const companyId = getActiveCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", String(limit));
  const res = await apiFetch<{ data: IntelligentClient[] }>(`/companies/${companyId}/clients/search?${params.toString()}`);
  return res.data;
}

export async function searchNfeProducts(q = "", limit = 25): Promise<Product[]> {
  const companyId = getActiveCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", String(limit));
  const res = await apiFetch<{ data: Product[] }>(`/companies/${companyId}/products/search?${params.toString()}`);
  return res.data;
}
