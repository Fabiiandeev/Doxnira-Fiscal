import { apiFetch, clearSession, saveSession } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function login(email: string, password: string) {
  const result = await apiFetch<{ user: AuthUser; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const companies = await apiFetch<{ data: Array<{ id: string }> }>("/companies", {
    headers: { authorization: `Bearer ${result.token}` },
  });
  saveSession({ ...result, companyId: companies.data[0]?.id });
  return result;
}

export async function register(name: string, email: string, password: string) {
  const result = await apiFetch<{ user: AuthUser; token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  saveSession(result);
  return result;
}

export async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("ns-fiscal-user");
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}
