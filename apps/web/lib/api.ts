import { getBrowserLocalStorage } from "@/lib/browser-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

export const storageKeys = {
  token: "ns-fiscal-token",
  companyId: "ns-fiscal-company-id",
  user: "ns-fiscal-user",
} as const;

export type SessionUser = { id: string; name: string; email: string; role: string };

type SessionState = {
  token: string | null;
  companyId: string | null;
  user: SessionUser | null;
};

const sessionState: SessionState = {
  token: null,
  companyId: null,
  user: null,
};

export function primeSession(input: Partial<SessionState>) {
  if (Object.prototype.hasOwnProperty.call(input, "token")) {
    sessionState.token = input.token ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "companyId")) {
    sessionState.companyId = input.companyId ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "user")) {
    sessionState.user = input.user ?? null;
  }
}

export function getSessionUser() {
  return sessionState.user;
}

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

function getSafeLocalStorage() {
  return getBrowserLocalStorage();
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const rawCookie = typeof document.cookie === "string" ? document.cookie : "";
  const match = rawCookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAgeSeconds};samesite=lax`;
  } catch {
    // Ignore browsers that do not expose writable cookies in this context.
  }
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${name}=;path=/;max-age=0;samesite=lax`;
  } catch {
    // Ignore browsers that do not expose writable cookies in this context.
  }
}

export function getToken() {
  if (sessionState.token) return sessionState.token;
  const storage = getSafeLocalStorage();
  const token = storage?.getItem(storageKeys.token);
  if (token) return token;
  return getCookie(storageKeys.token);
}

export function getCompanyId() {
  if (sessionState.companyId) return sessionState.companyId;
  const storage = getSafeLocalStorage();
  const companyId = storage?.getItem(storageKeys.companyId);
  if (companyId) return companyId;
  return getCookie(storageKeys.companyId);
}

export function setCompanyId(companyId: string) {
  sessionState.companyId = companyId;
  const storage = getSafeLocalStorage();
  storage?.setItem(storageKeys.companyId, companyId);
  setCookie(storageKeys.companyId, companyId);
  window.dispatchEvent(new CustomEvent("ns-fiscal-company-changed", { detail: companyId }));
}

export function saveSession(input: {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  companyId?: string;
}) {
  sessionState.token = input.token;
  sessionState.user = input.user;
  sessionState.companyId = input.companyId ?? null;
  const storage = getSafeLocalStorage();
  storage?.setItem(storageKeys.token, input.token);
  storage?.setItem(storageKeys.user, JSON.stringify(input.user));
  setCookie(storageKeys.token, input.token);
  setCookie(storageKeys.user, JSON.stringify(input.user));
  if (input.companyId) setCompanyId(input.companyId);
}

export function clearSession() {
  sessionState.token = null;
  sessionState.user = null;
  sessionState.companyId = null;
  const storage = getSafeLocalStorage();
  Object.values(storageKeys).forEach((key) => storage?.removeItem(key));
  clearCookie(storageKeys.token);
  clearCookie(storageKeys.user);
  clearCookie(storageKeys.companyId);
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
