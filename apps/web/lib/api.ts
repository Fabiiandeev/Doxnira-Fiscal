import { getBrowserLocalStorage } from "@/lib/browser-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
export const storageKeys = { companyId: "ns-fiscal-company-id" } as const;
export type SessionUser = { id: string; name: string; email: string; role: string };

let sessionUser: SessionUser | null = null;
export function primeSession(input: { companyId?: string | null; user?: SessionUser | null }) {
  if (Object.prototype.hasOwnProperty.call(input, "companyId") && input.companyId) setCompanyId(input.companyId);
  if (Object.prototype.hasOwnProperty.call(input, "user")) sessionUser = input.user ?? null;
}
export const getSessionUser = () => sessionUser;
export const setSessionUser = (user: SessionUser | null) => { sessionUser = user; };

export class ApiError extends Error {
  code: string; status: number; details: unknown; cause?: string | null; field?: string | null; suggestion?: string | null;
  autoFix?: { available: boolean; action: string | null; label: string | null } | null;
  constructor(message: string, code = "API_ERROR", status = 500, details: unknown = [], cause: string | null = null, field: string | null = null, suggestion: string | null = null, autoFix: { available: boolean; action: string | null; label: string | null } | null = null) {
    super(message); this.name = "ApiError"; this.code = code; this.status = status; this.details = details; this.cause = cause; this.field = field; this.suggestion = suggestion; this.autoFix = autoFix;
  }
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}
export function getCompanyId() {
  return getBrowserLocalStorage()?.getItem(storageKeys.companyId) || getCookie(storageKeys.companyId);
}
export function setCompanyId(companyId: string) {
  getBrowserLocalStorage()?.setItem(storageKeys.companyId, companyId);
  if (typeof document !== "undefined") document.cookie = `${storageKeys.companyId}=${encodeURIComponent(companyId)};path=/;max-age=604800;samesite=lax`;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ns-fiscal-company-changed", { detail: companyId }));
}
export function clearSession() {
  sessionUser = null;
  getBrowserLocalStorage()?.removeItem(storageKeys.companyId);
  if (typeof document !== "undefined") document.cookie = `${storageKeys.companyId}=;path=/;max-age=0;samesite=lax`;
}
const mutating = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = init.body instanceof FormData;
  const method = String(init.method || "GET").toUpperCase();
  const selectedCompanyId = getCompanyId();
  if (selectedCompanyId && !headers.has("x-company-id")) headers.set("x-company-id", selectedCompanyId);
  if (isFormData) headers.delete("content-type"); else if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (mutating.has(method) && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    const csrf = getCookie("ns-fiscal-csrf");
    if (csrf) headers.set("x-csrf-token", csrf);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
      const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
      const isPublicPage = publicPaths.some((item) =>
        item === "/" ? window.location.pathname === "/" : window.location.pathname === item || window.location.pathname.startsWith(`${item}/`),
      );
      if (!isPublicPage) window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(payload.message || "Não foi possível concluir a operação.", payload.code, response.status, payload.details, payload.cause || null, payload.field || null, payload.suggestion || null, payload.autoFix || null);
  }
  return payload as T;
}
