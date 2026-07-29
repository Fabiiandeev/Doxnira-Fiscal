import { apiFetch, getCompanyId } from "@/lib/api";
const company = () => { const id = getCompanyId(); if (!id) throw new Error("Selecione uma empresa."); return id; };
export const settingsApi = {
  get: <T>(path = "") => apiFetch<T>(`/companies/${company()}/settings${path}`),
  updateCompany: (body: Record<string, unknown>) => apiFetch(`/companies/${company()}/settings/company`, { method:"PATCH", body:JSON.stringify(body) }),
  integrationAction: (provider:string, action:string) => apiFetch(`/companies/${company()}/settings/integrations/${provider}/action`, { method:"POST", body:JSON.stringify({action}) }),
  revokeCertificate: () => apiFetch(`/companies/${company()}/settings/certificate/revoke`, { method:"POST" }),
  auditExportUrl: () => `/companies/${company()}/settings/audit/export`,
};
