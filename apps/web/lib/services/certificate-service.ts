import { apiFetch } from "@/lib/api";

export interface CertificateInfo {
  id: string;
  serialNumber: string | null;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validUntil: string | null;
  holderCnpj: string | null;
  status: string;
  daysRemaining: number | null;
  expired: boolean;
  valid: boolean;
}

export async function getCertificate(companyId: string) {
  return apiFetch<{ certificate: CertificateInfo | null }>(
    `/companies/${companyId}/certificate`,
  );
}

export async function uploadCertificate(
  companyId: string,
  file: File,
  password: string,
) {
  const body = new FormData();
  body.set("certificate", file);
  body.set("password", password);
  return apiFetch<{ certificate: CertificateInfo }>(
    `/companies/${companyId}/certificate`,
    { method: "POST", body },
  );
}

export async function deleteCertificate(companyId: string) {
  return apiFetch<void>(`/companies/${companyId}/certificate`, { method: "DELETE" });
}
