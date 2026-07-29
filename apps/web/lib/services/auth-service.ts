import { apiFetch, clearSession, getSessionUser, setCompanyId, setSessionUser } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResult {
  user: AuthUser;
  hasCompany: boolean;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<{ user: AuthUser; csrfToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const companies = await apiFetch<{ data: Array<{ id: string }> }>("/companies", {
  });
  const firstCompanyId = companies.data[0]?.id;
  setSessionUser(result.user);
  if (firstCompanyId) setCompanyId(firstCompanyId);
  return { ...result, hasCompany: !!firstCompanyId };
}

export async function register(name: string, email: string, password: string) {
  const result = await apiFetch<{ user: AuthUser; csrfToken: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  setSessionUser(result.user);
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
  return getSessionUser();
}
