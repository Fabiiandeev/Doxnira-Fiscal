import { apiFetch, getToken } from "@/lib/api";

export type AccountantCompany = {
  office: { id: string; name: string };
  accessLevel: "FULL" | "READ_ONLY" | "RESTRICTED";
  permissions: string[];
  company: { id: string; legalName: string; tradeName: string | null; cnpj: string };
};

type AccountantRequest = { companyId: string; officeId: string };

function headers(input: AccountantRequest) {
  return { "x-accountant-office-id": input.officeId };
}

export function listAccountantCompanies() {
  return apiFetch<{ data: AccountantCompany[] }>("/accountant/companies");
}

export type AccountantMonthlyClosing = {
  id: string; periodYear: number; periodMonth: number; status: string; inboundTotal: number; outboundTotal: number; freightTotal: number;
  includedDocuments: number; eligibleDocuments?: number; blockedDocuments?: number; pendingCount?: number;
  warnings: Array<{ id: string; code: string; severity: string; message: string; suggestion?: string | null }>;
  items: Array<{ id: string; category: string; amount: number; taxAmount: number; accessKey?: string | null }>;
  events?: Array<{ id: string; action: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; createdAt: string }>;
};
export function listAccountantMonthlyClosings(input: AccountantRequest & { periodYear?: number; periodMonth?: number }) {
  const params = new URLSearchParams(); if (input.periodYear) params.set("periodYear", String(input.periodYear)); if (input.periodMonth) params.set("periodMonth", String(input.periodMonth));
  return apiFetch<{ data: AccountantMonthlyClosing[] }>(`/accountant/companies/${input.companyId}/monthly-tax-closings?${params}`, { headers: headers(input) });
}
export function createAccountantMonthlyClosing(input: AccountantRequest & { periodYear: number; periodMonth: number }) { return apiFetch<AccountantMonthlyClosing>(`/accountant/companies/${input.companyId}/monthly-tax-closings`, { method: "POST", headers: headers(input), body: JSON.stringify(input) }); }
export function accountantMonthlyClosingAction(input: AccountantRequest & { closingId: string; action: "recalculate" | "approve" | "reopen"; note?: string; reason?: string }) { return apiFetch<AccountantMonthlyClosing>(`/accountant/companies/${input.companyId}/monthly-tax-closings/${input.closingId}/${input.action}`, { method: "POST", headers: headers(input), body: JSON.stringify({ note: input.note, reason: input.reason }) }); }
export function listFiscalBookPreparations(input: AccountantRequest) { return apiFetch<{data:Array<Record<string, unknown>>}>(`/accountant/companies/${input.companyId}/fiscal-book-preparations`, {headers:headers(input)}); }
export function createFiscalBookPreparation(input: AccountantRequest & {closingId:string}) { return apiFetch<Record<string, unknown>>(`/accountant/companies/${input.companyId}/fiscal-book-preparations`, {method:"POST",headers:headers(input),body:JSON.stringify({closingId:input.closingId})}); }
export function getFiscalBookPreparation(input: AccountantRequest & {preparationId:string; suffix?:string}) { return apiFetch<Record<string, unknown>>(`/accountant/companies/${input.companyId}/fiscal-book-preparations/${input.preparationId}${input.suffix||""}`, {headers:headers(input)}); }
export function updateFiscalBookIssue(input: AccountantRequest & {preparationId:string; issueId:string; action:"resolve"|"ignore"; reason?:string}) { return apiFetch(`/accountant/companies/${input.companyId}/fiscal-book-preparations/${input.preparationId}/issues/${input.issueId}/${input.action}`, {method:"POST",headers:headers(input),body:JSON.stringify({reason:input.reason})}); }

export type FiscalBookPreparationSummary = { id: string; periodYear: number; periodMonth: number; status: string; documentsCount: number; itemsCount: number; issuesCount: number; blockingIssuesCount: number };
export type FiscalExport = { id: string; preparationId: string; closingId: string; type: "SPED_FISCAL" | "SINTEGRA"; periodYear: number; periodMonth: number; status: string; layoutVersion: string; contentHash: string; fileName: string; sizeBytes: number; generatedAt: string; generatedByUserId: string | null; snapshot?: Record<string, unknown>; error?: Record<string, unknown> | null };
export function validateFiscalExport(input: AccountantRequest & { preparationId: string }) { return apiFetch<{ valid: boolean; preparationId: string; closingId: string; status: string; layoutVersions: Record<string, string> }>(`/accountant/companies/${input.companyId}/fiscal-exports/validate`, { method: "POST", headers: headers(input), body: JSON.stringify({ preparationId: input.preparationId }) }); }
export function createFiscalExport(input: AccountantRequest & { preparationId: string; type: FiscalExport["type"] }) { return apiFetch<FiscalExport>(`/accountant/companies/${input.companyId}/fiscal-exports`, { method: "POST", headers: headers(input), body: JSON.stringify({ preparationId: input.preparationId, type: input.type }) }); }
export function listFiscalExports(input: AccountantRequest & { preparationId?: string }) { const params = new URLSearchParams(); if (input.preparationId) params.set("preparationId", input.preparationId); return apiFetch<{ data: FiscalExport[]; pagination: { page: number; total: number; totalPages: number } }>(`/accountant/companies/${input.companyId}/fiscal-exports?${params}`, { headers: headers(input) }); }
export async function downloadFiscalExport(input: AccountantRequest & { exportId: string; fileName: string }) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api"}/accountant/companies/${input.companyId}/fiscal-exports/${input.exportId}/download`, { headers: { authorization: `Bearer ${getToken()}`, "x-accountant-office-id": input.officeId } });
  if (!response.ok) throw new Error("Falha ao baixar exportação fiscal.");
  const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = input.fileName; anchor.click(); URL.revokeObjectURL(url);
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
export function listAccountantDocumentReviewHistory(input: DocumentActionInput) {
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/fiscal-documents/${input.documentId}/review-history`, { headers: headers(input) });
}

type AccountantTransportDetail = {
  id: string;
  companyId: string;
  documentType: string;
  operationDirection: string | null;
  identification: Record<string, string | boolean | null>;
  issuer: { name?: string; document?: string } | null;
  recipient: { name?: string; document?: string } | null;
  totals: Record<string, string | null>;
  xml: { availability: string; canDownload: boolean; canView: boolean };
  review: { status?: string; user?: { name?: string }; note?: string; reviewedAt?: string | null; reopenedAt?: string | null; reopenReason?: string | null } | null;
  nfeLinks: Array<{ id: string; accessKey: string; source: string; createdAt: string; xml: { availability: string; canDownload: boolean }; document: { id: string; invoiceNumber: string | null; series: string | null; accessKey: string | null; totalAmount: string | null } }>;
  pendingReferences: Array<{ id: string; accessKey: string; source: string; createdAt: string; status: string }>;
};
export type { AccountantTransportDetail };

export async function downloadAccountantTransportXml(input: DocumentActionInput) {
  const token = getToken();
  const params = new URLSearchParams({ companyId: input.companyId, officeId: input.officeId });
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api"}/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/download-xml`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, "x-accountant-office-id": input.officeId, "x-accountant-context": params.toString() } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Falha ao baixar XML do CT-e.");
  }
  return response.blob();
}

export function listAccountantTransportDocumentNotes(input: DocumentActionInput) {
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/notes`, { headers: headers(input) });
}
export function createAccountantTransportDocumentNote(input: DocumentActionInput & { content: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/notes`, { method: "POST", headers: headers(input), body: JSON.stringify({ content: input.content }) });
}
export function deleteAccountantTransportDocumentNote(input: DocumentActionInput & { noteId: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/notes/${input.noteId}`, { method: "DELETE", headers: headers(input) });
}
export function listAccountantTransportDocumentTags(input: DocumentActionInput) {
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/tags`, { headers: headers(input) });
}
export function assignAccountantTransportDocumentTag(input: DocumentActionInput & { tagId: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/tags/${input.tagId}`, { method: "POST", headers: headers(input) });
}
export function removeAccountantTransportDocumentTag(input: DocumentActionInput & { tagId: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/tags/${input.tagId}`, { method: "DELETE", headers: headers(input) });
}
export function listAccountantTransportDocumentRequests(input: DocumentActionInput) {
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/requests`, { headers: headers(input) });
}
export function createAccountantTransportDocumentRequest(input: DocumentActionInput & { type: string; priority: string; description?: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/requests`, { method: "POST", headers: headers(input), body: JSON.stringify({ type: input.type, priority: input.priority, description: input.description }) });
}
export function updateAccountantTransportDocumentReview(input: DocumentActionInput & { status: string; note?: string; reopenReason?: string; category?: string; priority?: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/review`, { method: "POST", headers: headers(input), body: JSON.stringify(input) });
}
export function listAccountantTransportDocumentReviewHistory(input: DocumentActionInput) {
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/review-history`, { headers: headers(input) });
}
export function getAccountantTransportDocumentXml(input: DocumentActionInput) {
  return apiFetch<{ id: string; accessKey: string | null; xml: string; hash: string; availability: string }>(`/accountant/companies/${input.companyId}/transport-documents/${input.documentId}/xml`, { headers: headers(input) });
}

export function transitionAccountantDocumentRequest(input: AccountantRequest & { requestId: string; status: string; responseMessage?: string }) {
  return apiFetch(`/accountant/companies/${input.companyId}/requests/${input.requestId}`, { method: "PATCH", headers: headers(input), body: JSON.stringify({ status: input.status, responseMessage: input.responseMessage }) });
}
export function listAccountantRequests(input: AccountantRequest & { filters?: Record<string, string> }) {
  const params = new URLSearchParams(input.filters || {});
  return apiFetch<Array<Record<string, unknown>>>(`/accountant/companies/${input.companyId}/requests?${params}`, { headers: headers(input) });
}
export function listCompanyDocumentRequests(companyId: string) { return apiFetch<Array<Record<string, unknown>>>(`/companies/${companyId}/document-requests`); }
export function acceptCompanyDocumentRequest(companyId: string, requestId: string) { return apiFetch(`/companies/${companyId}/document-requests/${requestId}/accept`, { method: "POST" }); }
export function respondCompanyDocumentRequest(companyId: string, requestId: string, message: string) { return apiFetch(`/companies/${companyId}/document-requests/${requestId}/respond`, { method: "POST", body: JSON.stringify({ message }) }); }
