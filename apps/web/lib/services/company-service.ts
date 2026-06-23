import { apiFetch } from "@/lib/api";

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration?: string | null;
  stateRegistrationStatus?: string | null;
  stateRegistrationSource?: string | null;
  stateRegistrationFormatted?: string | null;
  icmsContributorStatus?: string | null;
  uf: string | null;
  city?: string | null;
  taxRegime?: string | null;
  environment: "production" | "homologation";
  status: string;
  nfeLastNsu: string;
  nfeMaxNsu: string | null;
  nfeNextAllowedSyncAt: string | null;
  lastSyncAt: string | null;
  _count?: { fiscalDocuments: number; alerts: number };
}

export async function listCompanies() {
  return apiFetch<{ data: Company[] }>("/companies");
}

export async function getCompany(companyId: string) {
  return apiFetch<Company>(`/companies/${companyId}`);
}

export async function updateCompany(companyId: string, data: Partial<Company>) {
  return apiFetch<Company>(`/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCompany(companyId: string) {
  return apiFetch<{ message: string }>(`/companies/${companyId}`, {
    method: "DELETE",
  });
}

export async function createCompany(data: {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  uf?: string;
  city?: string;
  stateRegistration?: string;
  stateRegistrationStatus?: string;
  stateRegistrationSource?: string;
  stateRegistrationFormatted?: string;
  icmsContributorStatus?: string;
  taxRegime?: string;
  environment?: "production" | "homologation";
}) {
  return apiFetch<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
