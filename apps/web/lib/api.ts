const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

export const storageKeys = {
  token: "ns-fiscal-token",
  companyId: "ns-fiscal-company-id",
  user: "ns-fiscal-user",
} as const;

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;
  cause?: string | null;
  field?: string | null;
  suggestion?: string | null;
  autoFix?: { available: boolean; action: string | null; label: string | null } | null;

  constructor(
    message: string,
    code = "API_ERROR",
    status = 500,
    details: unknown = [],
    cause: string | null = null,
    field: string | null = null,
    suggestion: string | null = null,
    autoFix: { available: boolean; action: string | null; label: string | null } | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.cause = cause;
    this.field = field;
    this.suggestion = suggestion;
    this.autoFix = autoFix;
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKeys.token);
}

export function getCompanyId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKeys.companyId);
}

export function setCompanyId(companyId: string) {
  window.localStorage.setItem(storageKeys.companyId, companyId);
  window.dispatchEvent(new CustomEvent("ns-fiscal-company-changed", { detail: companyId }));
}

export function saveSession(input: {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  companyId?: string;
}) {
  window.localStorage.setItem(storageKeys.token, input.token);
  window.localStorage.setItem(storageKeys.user, JSON.stringify(input.user));
  document.cookie = `${storageKeys.token}=${input.token};path=/;max-age=604800;samesite=lax`;
  if (input.companyId) setCompanyId(input.companyId);
}

export function clearSession() {
  Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
  document.cookie = `${storageKeys.token}=;path=/;max-age=0`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("API_ERROR_STATUS", response.status, "path", path);
    console.error("API_ERROR_BODY", JSON.stringify(payload, null, 2));
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
  return payload as T;
}
