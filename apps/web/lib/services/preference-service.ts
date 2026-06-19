import { apiFetch } from "@/lib/api";

export interface Preferences {
  theme: "light" | "dark" | "system";
  accentColor: string;
  defaultCompanyId: string | null;
  tableDensity: "compact" | "comfortable";
  dashboardLayout?: { brand?: string } | null;
}

export async function getPreferences() {
  return apiFetch<{ preferences: Preferences | null }>("/preferences");
}

export async function savePreferences(data: Partial<Preferences>) {
  return apiFetch<{ preferences: Preferences }>("/preferences", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
