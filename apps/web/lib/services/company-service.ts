import { apiFetch } from "@/lib/api";
import type { CertificateInfo } from "@/lib/services/certificate-service";
import type { CompanyTaxSettings } from "@/lib/types";

export type CompanyValidationSeverity = "error" | "warning" | "info";

export interface CompanyValidationIssue {
  id: string;
  title: string;
  explanation: string;
  impact: string;
  field: string;
  action: string;
  severity: CompanyValidationSeverity;
}

export interface CompanyValidationResult {
  score: number;
  status: "ready" | "attention" | "blocked";
  issues: CompanyValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    readyForClosing: boolean;
    fiscalConfigComplete: boolean;
  };
}

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
  createdAt?: string;
  updatedAt?: string;
  _count?: { fiscalDocuments: number; alerts: number };
  taxSettings?: Partial<CompanyTaxSettings> | null;
  certificate?: Pick<
    CertificateInfo,
    "id" | "status" | "validUntil" | "holderCnpj" | "validatedAt"
  > | null;
  validation?: CompanyValidationResult;
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

export async function validateCompany(companyId: string) {
  return apiFetch<CompanyValidationResult>(`/companies/${companyId}/validate`, {
    method: "POST",
  });
}

export async function saveCompanyFiscalSettings(
  companyId: string,
  data: Partial<CompanyTaxSettings>,
) {
  return apiFetch<CompanyTaxSettings>(`/companies/${companyId}/fiscal-settings`, {
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
