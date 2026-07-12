import { ApiError, apiFetch, clearSession, getCompanyId, getToken } from "@/lib/api";
import type { IntelligentClient } from "@/lib/client-types";
import type { NfeActionResponse, NfeAutoFixResponse, NfeBoletoMock, NfeDetailActionResponse, NfeDetailResponse, NfeFilters, NfeListResponse, NfeReceivable } from "@/lib/nfe-types";
import type { Cfop, Product } from "@/lib/product-types";
import type { Transportadora } from "@/lib/transportadora-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

type NfeDanfeCommonArtifact = {
  title: string;
  accessKey: string | null;
  number: number | null;
  series: number | null;
  issuerName: string | null;
  recipientCnpj: string | null;
  totalAmount: number;
  status: string;
  message?: string | null;
};

export type NfeDanfeHtmlArtifact = NfeDanfeCommonArtifact & {
  kind: "html";
  html: string;
  fileName: string;
  mimeType: string;
};

export type NfeDanfeLinkArtifact = NfeDanfeCommonArtifact & {
  kind: "link";
  url?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
  contentBase64?: string | null;
};

export type NfeDanfeBlobArtifact = NfeDanfeCommonArtifact & {
  kind: "blob";
  blob: Blob;
  fileName: string;
  mimeType: string;
};

export type NfeDanfeArtifact = NfeDanfeHtmlArtifact | NfeDanfeLinkArtifact | NfeDanfeBlobArtifact;

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

export async function patchNfe(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}`, {
    method: "PATCH",
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

export async function transmitNfe(nfeId: string, payload: Record<string, unknown> = { mock: true }): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/transmit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transmitNfeMock(nfeId: string): Promise<NfeActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/transmit-mock`, { method: "POST" });
}

export async function recalculateNfe(nfeId: string): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/recalculate`, { method: "POST" });
}

export async function applyNfeAutoFix(nfeId: string): Promise<NfeAutoFixResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/auto-fix`, { method: "POST" });
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

export async function getNfeEvents(nfeId: string) {
  const companyId = getActiveCompanyId();
  return apiFetch<{
    data: Array<{ id: string; action: string; details?: unknown; createdAt: string }>;
  }>(`/companies/${companyId}/nfe/${nfeId}/events`);
}

export async function getNfeXmlPreview(nfeId: string) {
  const companyId = getActiveCompanyId();
  return apiFetch<{
    data: { xml: string; authorized: boolean; fileName: string; mimeType: string; message: string };
  }>(`/companies/${companyId}/nfe/${nfeId}/xml-preview`);
}

export async function getNfeDanfe(nfeId: string): Promise<{ data: NfeDanfeArtifact }> {
  const companyId = getActiveCompanyId();
  const response = await fetchWithAuth(`/companies/${companyId}/nfe/${nfeId}/danfe`);
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    throw new ApiError(
      payload.message || "Não foi possível concluir a operação.",
      payload.code,
      response.status,
      payload.details,
      payload.cause || null,
      payload.field || null,
      payload.suggestion || null,
      payload.autoFix || null,
    );
  }

  if (contentType.includes("json")) {
    const payload = await response.json();
    const data = payload?.data ?? payload;
    if (data?.kind === "html" || typeof data?.html === "string") {
      return {
        data: {
          kind: "html",
          title: data?.title || "DANFE - Documento Auxiliar da NF-e",
          accessKey: data?.accessKey ?? null,
          number: data?.number ?? null,
          series: data?.series ?? null,
          issuerName: data?.issuerName ?? null,
          recipientCnpj: data?.recipientCnpj ?? null,
          totalAmount: Number(data?.totalAmount || 0),
          html: String(data?.html || ""),
          fileName: data?.fileName || `danfe-nfe-saida-${data?.accessKey || nfeId}.html`,
          mimeType: data?.mimeType || "text/html;charset=utf-8",
          status: data?.status || "READY",
          message: data?.message ?? null,
        },
      };
    }
    return {
      data: {
        kind: "link" as const,
        title: data?.title || "DANFE - Documento Auxiliar da NF-e",
        accessKey: data?.accessKey ?? null,
        number: data?.number ?? null,
        series: data?.series ?? null,
        issuerName: data?.issuerName ?? null,
        recipientCnpj: data?.recipientCnpj ?? null,
        totalAmount: Number(data?.totalAmount || 0),
        url: data?.url ?? null,
        storageKey: data?.storageKey ?? null,
        status: data?.status ?? "READY",
        message: data?.message ?? null,
        fileName: data?.fileName ?? null,
        mimeType: data?.mimeType ?? null,
        base64: data?.base64 ?? null,
        contentBase64: data?.contentBase64 ?? null,
      },
    };
  }

  if (contentType.includes("text/html")) {
    const html = await response.text();
    return {
      data: {
        kind: "html",
        title: "DANFE - Documento Auxiliar da NF-e",
        accessKey: null,
        number: null,
        series: null,
        issuerName: null,
        recipientCnpj: null,
        totalAmount: 0,
        html,
        fileName: `danfe-${nfeId}.html`,
        mimeType: "text/html;charset=utf-8",
        status: response.headers.get("x-danfe-status") || "READY",
        message: response.headers.get("x-danfe-message") || null,
      },
    };
  }

  const blob = await response.blob();
  const fileName = extractFileNameFromDisposition(
    response.headers.get("content-disposition"),
    `danfe-${nfeId}.pdf`,
  );
  return {
    data: {
      kind: "blob" as const,
      title: "DANFE - Documento Auxiliar da NF-e",
      accessKey: null,
      number: null,
      series: null,
      issuerName: null,
      recipientCnpj: null,
      totalAmount: 0,
      blob,
      fileName,
      mimeType: blob.type || contentType || "application/pdf",
      status: response.headers.get("x-danfe-status") || "READY",
      message: response.headers.get("x-danfe-message") || null,
    },
  };
}

type FetchWithAuthInit = RequestInit & { headers?: HeadersInit };

function buildHeaders(init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getToken();
  const isFormData = init.body instanceof FormData;

  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (isFormData) {
    headers.delete("content-type");
  } else if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function fetchWithAuth(path: string, init: FetchWithAuthInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(init),
    cache: "no-store",
  });
}

function extractFileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
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

export async function updateNfeBilling(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/billing`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateNfeTransport(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/transport`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function generateNfeFinancial(nfeId: string, payload: Record<string, unknown> = {}): Promise<{
  financial: { receivables: NfeReceivable[] };
  message?: string;
}> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/generate-financial`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateNfeBoletoMock(nfeId: string): Promise<{
  boleto: NfeBoletoMock;
  financial: { receivables: NfeReceivable[] };
  message?: string;
}> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/${nfeId}/boleto`, { method: "POST" });
}

export async function processNfeWebhookMock(payload: Record<string, unknown>): Promise<{
  processed: boolean;
  idempotent: boolean;
  eventId: string;
  status: string;
  message?: string;
}> {
  const companyId = getActiveCompanyId();
  return apiFetch(`/companies/${companyId}/nfe/webhooks/mock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export async function searchNfeCarriers(q = "", limit = 25): Promise<Transportadora[]> {
  const companyId = getActiveCompanyId();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", String(limit));
  const qs = params.toString();
  const res = await apiFetch<{ data: Transportadora[] }>(`/companies/${companyId}/transportadoras${qs ? `?${qs}` : ""}`);
  return res.data;
}
