import { apiFetch } from "@/lib/api";

export type AccountantCompany = {
  office: { id: string; name: string };
  accessLevel: "FULL" | "READ_ONLY" | "RESTRICTED";
  company: { id: string; legalName: string; tradeName: string | null; cnpj: string };
};

type AccountantRequest = { companyId: string; officeId: string };

function headers(input: AccountantRequest) {
  return { "x-accountant-office-id": input.officeId };
}

export function listAccountantCompanies() {
  return apiFetch<{ data: AccountantCompany[] }>("/accountant/companies");
}

export function getAccountantDocuments(input: AccountantRequest & { page: number; filters: Record<string, string> }) {
  const params = new URLSearchParams({ page: String(input.page), pageSize: "25", sortBy: "emissionDate", sortOrder: "desc" });
  Object.entries(input.filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  return apiFetch<{ data: Array<Record<string, unknown>>; pagination: { page: number; total: number; totalPages: number } }>(
    `/accountant/companies/${input.companyId}/fiscal-documents?${params}`,
    { headers: headers(input) },
  );
}

export function getAccountantDocumentsSummary(input: AccountantRequest & { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams();
  if (input.startDate) params.set("startDate", input.startDate);
  if (input.endDate) params.set("endDate", input.endDate);
  return apiFetch<Record<string, number>>(`/accountant/companies/${input.companyId}/fiscal-documents/summary?${params}`, { headers: headers(input) });
}

export function getAccountantDocumentDetail(input: AccountantRequest & { documentId: string }) {
  return apiFetch<Record<string, unknown>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}`, { headers: headers(input) });
}

export function getAccountantDocumentXml(input: AccountantRequest & { documentId: string }) {
  return apiFetch<{ id: string; accessKey: string | null; xml: string; isSummary: boolean }>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/xml`, { headers: headers(input) });
}

type DocumentActionInput = AccountantRequest & { documentId: string };
export function listAccountantDocumentNotes(input: DocumentActionInput) { return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/notes`, { headers: headers(input) }); }
export function createAccountantDocumentNote(input: DocumentActionInput & { content: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/notes`, { method: "POST", headers: headers(input), body: JSON.stringify({ content: input.content }) }); }
export function deleteAccountantDocumentNote(input: DocumentActionInput & { noteId: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/notes/${input.noteId}`, { method: "DELETE", headers: headers(input) }); }
export function updateAccountantDocumentNote(input: DocumentActionInput & { noteId: string; content: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/notes/${input.noteId}`, { method: "PATCH", headers: headers(input), body: JSON.stringify({ content: input.content }) }); }
export function listAccountantTags(input: AccountantRequest) { return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/tags`, { headers: headers(input) }); }
export function createAccountantTag(input: AccountantRequest & { name: string; color?: string }) { return apiFetch(`/accountant/companies/${input.companyId}/tags`, { method: "POST", headers: headers(input), body: JSON.stringify({ name: input.name, color: input.color }) }); }
export function listAccountantDocumentTags(input: DocumentActionInput) { return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/tags`, { headers: headers(input) }); }
export function assignAccountantDocumentTag(input: DocumentActionInput & { tagId: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/tags/${input.tagId}`, { method: "POST", headers: headers(input) }); }
export function removeAccountantDocumentTag(input: DocumentActionInput & { tagId: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/tags/${input.tagId}`, { method: "DELETE", headers: headers(input) }); }
export function listAccountantDocumentRequests(input: DocumentActionInput) { return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/requests`, { headers: headers(input) }); }
export function createAccountantDocumentRequest(input: DocumentActionInput & { type: string; priority: string; description?: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/requests`, { method: "POST", headers: headers(input), body: JSON.stringify({ type: input.type, priority: input.priority, description: input.description }) }); }
export function updateAccountantDocumentReview(input: DocumentActionInput & { status: string; note?: string; reopenReason?: string; category?: string; priority?: string }) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/review`, { method: "POST", headers: headers(input), body: JSON.stringify(input) }); }
export function getAccountantTransportDocuments(input: AccountantRequest & { page: number; filters?: Record<string, string> }) { const params = new URLSearchParams({ page: String(input.page), pageSize: "25" }); Object.entries(input.filters || {}).forEach(([key, value]) => value && params.set(key, value)); return apiFetch<{ data: Array<Record<string, unknown>>; pagination: { page: number; total: number; totalPages: number } }>(`/accountant/companies/${input.companyId}/transport-documents?${params}`, { headers: headers(input) }); }
export function getAccountantTransportSummary(input: AccountantRequest) { return apiFetch<Record<string, number>>(`/accountant/companies/${input.companyId}/transport-documents/summary`, { headers: headers(input) }); }
export function getAccountantTransportDetail(input: DocumentActionInput) { return apiFetch<Record<string, unknown>>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}`, { headers: headers(input) }); }
export function reprocessAccountantTransportLinks(input: DocumentActionInput) { return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/reprocess-links`, { method: "POST", headers: headers(input) }); }
export function listAccountantDocumentReviewHistory(input: DocumentActionInput) { return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/review-history`, { headers: headers(input) }); }
