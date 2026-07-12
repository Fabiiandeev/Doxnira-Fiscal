import { ApiError, apiFetch, clearSession, getCompanyId, getToken } from "@/lib/api";
import type { NfeEntry, NfeEntryFilters, NfeEntryListResponse } from "@/lib/nfe-entry-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

function companyId() {
  const id = getCompanyId();
  if (!id) throw new Error("Selecione uma empresa.");
  return id;
}

function queryString(input: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function listNfeEntries(input: {
  page: number;
  pageSize: number;
  filters: NfeEntryFilters;
}): Promise<NfeEntryListResponse> {
  const qs = queryString({ page: input.page, pageSize: input.pageSize, ...input.filters });
  return apiFetch(`/companies/${companyId()}/nfe-entry${qs}`);
}

export async function getNfeEntry(id: string): Promise<{ data: NfeEntry }> {
  return apiFetch(`/companies/${companyId()}/nfe-entry/${id}`);
}

export async function syncNfeEntries(mock = false): Promise<{ data: NfeEntry[]; message: string }> {
  return apiFetch(`/companies/${companyId()}/nfe-entry/sync`, {
    method: "POST",
    body: JSON.stringify({ mock }),
  });
}

export async function importNfeEntryXml(file: File): Promise<{ data: NfeEntry; message: string }> {
  const form = new FormData();
  form.set("xml", file);
  return apiFetch(`/companies/${companyId()}/nfe-entry/import-xml`, {
    method: "POST",
    body: form,
  });
}

export async function manifestNfeEntry(id: string, eventType: string, justification?: string) {
  return apiFetch<{ data: NfeEntry; protocol: string; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/manifest`, {
    method: "POST",
    body: JSON.stringify({ eventType, justification }),
  });
}

export async function linkNfeEntryProducts(
  id: string,
  links: Array<{ itemId: string; productId?: string | null; ignoreStock?: boolean }>,
) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/link-products`, {
    method: "POST",
    body: JSON.stringify({ links }),
  });
}

export async function autoLinkNfeEntryProducts(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/link-products`, {
    method: "POST",
    body: JSON.stringify({ links: [] }),
  });
}

export async function validateNfeEntry(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/validate`, { method: "POST" });
}

export async function prepareNfeEntryInventory(id: string) {
  return apiFetch<{ data: NfeEntry; inventory: { status: string; canPost: boolean }; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/prepare-inventory`, { method: "POST" });
}

export async function postNfeEntryInventory(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/post-inventory`, { method: "POST" });
}

export async function confirmNfeEntry(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/confirm-entry`, {
    method: "POST",
  });
}

export async function generateNfeEntryPayables(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/generate-payables`, {
    method: "POST",
  });
}

export async function prepareNfeEntryBookkeeping(id: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/prepare-bookkeeping`, { method: "POST" });
}

export async function ignoreNfeEntry(id: string, reason?: string) {
  return apiFetch<{ data: NfeEntry; message: string }>(`/companies/${companyId()}/nfe-entry/${id}/ignore`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getNfeEntryXml(id: string) {
  return apiFetch<{ id: string; accessKey: string; xml: string; hash: string | null }>(`/companies/${companyId()}/nfe-entry/${id}/xml`);
}

export type NfeEntryDanfeHtmlArtifact = {
  kind: "html";
  title: string;
  accessKey: string;
  number: string | null;
  series: string | null;
  supplierName: string | null;
  recipientCnpj: string | null;
  totalAmount: number;
  html: string;
  fileName: string;
  mimeType: string;
  status: string;
  message?: string | null;
};

export type NfeEntryDanfeLinkArtifact = {
  kind: "link";
  url?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  status: string;
  message?: string | null;
};

export type NfeEntryDanfeBlobArtifact = {
  kind: "blob";
  blob: Blob;
  fileName: string;
  mimeType: string;
  status: string;
  message?: string | null;
};

export type NfeEntryDanfeArtifact = NfeEntryDanfeHtmlArtifact | NfeEntryDanfeLinkArtifact | NfeEntryDanfeBlobArtifact;

export async function getNfeEntryDanfe(id: string): Promise<{ data: NfeEntryDanfeArtifact }> {
  const response = await fetchWithAuth(`/companies/${companyId()}/nfe-entry/${id}/danfe`);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

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

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => ({}));
    const data = payload?.data ?? payload;
    if (data?.kind === "blob" && data?.blob instanceof Blob) {
      return { data: data as NfeEntryDanfeBlobArtifact };
    }
    if (data?.url || data?.storageKey) {
      return {
        data: {
          kind: "link",
          url: data.url ?? null,
          storageKey: data.storageKey ?? null,
          fileName: data.fileName ?? null,
          mimeType: data.mimeType ?? null,
          status: data.status ?? "READY",
          message: data.message ?? null,
        },
      };
    }
    return {
      data: {
        kind: "html",
        title: data?.title || "DANFE - Documento Auxiliar da NF-e",
        accessKey: data?.accessKey || "",
        number: data?.number ?? null,
        series: data?.series ?? null,
        supplierName: data?.supplierName ?? null,
        recipientCnpj: data?.recipientCnpj ?? null,
        totalAmount: Number(data?.totalAmount || 0),
        html: String(data?.html || ""),
        fileName: data?.fileName || `danfe-nfe-entrada-${data?.accessKey || id}.html`,
        mimeType: data?.mimeType || "text/html;charset=utf-8",
        status: data?.status || "READY",
        message: data?.message ?? null,
      },
    };
  }

  if (contentType.includes("text/html")) {
    const html = await response.text();
    return {
      data: {
        kind: "html",
        title: "DANFE - Documento Auxiliar da NF-e",
        accessKey: "",
        number: null,
        series: null,
        supplierName: null,
        recipientCnpj: null,
        totalAmount: 0,
        html,
        fileName: `danfe-nfe-entrada-${id}.html`,
        mimeType: "text/html;charset=utf-8",
        status: response.headers.get("x-danfe-status") || "READY",
        message: response.headers.get("x-danfe-message") || null,
      },
    };
  }

  const blob = await response.blob();
  return {
    data: {
      kind: "blob",
      blob,
      fileName: extractFileNameFromDisposition(response.headers.get("content-disposition"), `danfe-nfe-entrada-${id}.pdf`),
      mimeType: blob.type || contentType || "application/pdf",
      status: response.headers.get("x-danfe-status") || "READY",
      message: response.headers.get("x-danfe-message") || null,
    },
  };
}

async function fetchWithAuth(path: string, init: RequestInit = {}) {
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

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
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
