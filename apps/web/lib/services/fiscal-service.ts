import { apiFetch, getCompanyId } from "@/lib/api";
import type { DocumentFilters, FiscalDocument } from "@/lib/types";

export async function searchDocuments(input: {
  page: number;
  pageSize: number;
  filters: DocumentFilters;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{
  data: FiscalDocument[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
    sortBy: input.sortBy || "emissionDate",
    sortOrder: input.sortOrder || "desc",
  });
  Object.entries(input.filters).forEach(([key, value]) => {
    if (value !== "" && value !== false) params.set(key, String(value));
  });
  return apiFetch(`/companies/${companyId}/documents/search?${params}`);
}

export async function getDocument(id: string) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return apiFetch<FiscalDocument & {
    products?: Array<Record<string, unknown>>;
    taxes?: Record<string, number>;
  }>(`/companies/${companyId}/documents/${id}`);
}

export async function getDocumentXml(id: string, download = false) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return apiFetch<{ id: string; accessKey: string; xml: string; hash: string }>(
    `/companies/${companyId}/documents/${id}/xml${download ? "?download=true" : ""}`,
  );
}

export async function importFiscalXml(file: File) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  const body = new FormData();
  body.append("xml", file);
  return apiFetch<{ document: FiscalDocument; linkedNfeCount: number }>(
    `/companies/${companyId}/documents/import-xml`,
    { method: "POST", body },
  );
}

export async function manifestDocument(
  id: string,
  eventType: string,
  justification?: string,
  mode: "mock" | "real" = "mock",
  confirm = false,
) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return apiFetch(`/companies/${companyId}/documents/${id}/manifest`, {
    method: "POST",
    body: JSON.stringify({ eventType, justification, mode, confirm }),
  });
}
