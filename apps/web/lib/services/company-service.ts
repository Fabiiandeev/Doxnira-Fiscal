import { apiFetch } from "@/lib/api";

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration?: string | null;
  uf: string | null;
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

export async function createCompany(data: {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  uf?: string;
  stateRegistration?: string;
  taxRegime?: string;
  environment?: "production" | "homologation";
}) {
  return apiFetch<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
