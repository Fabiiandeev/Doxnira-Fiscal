import { apiFetch } from "@/lib/api";
import type { FiscalDocument } from "@/lib/types";

export interface DashboardSummary {
  documents: number;
  totalAmount: number;
  fullXml: number;
  summaryXml: number;
  cancelled: number;
  openAlerts: number;
}

export interface DashboardAlert {
  id: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  status: string;
  createdAt: string;
  fiscalDocumentId: string | null;
}

export async function getDashboard(companyId: string) {
  const [summary, monthly, xml, suppliers, latest, alerts] = await Promise.all([
    apiFetch<DashboardSummary>(`/companies/${companyId}/dashboard/summary`),
    apiFetch<{ data: Array<{ month: string; documents: number; totalAmount: number }> }>(
      `/companies/${companyId}/dashboard/monthly-flow`,
    ),
    apiFetch<{ data: Array<{ name: string; value: number; percentage: number }> }>(
      `/companies/${companyId}/dashboard/xml-distribution`,
    ),
    apiFetch<{
      data: Array<{
        issuerName: string;
        issuerCnpj: string;
        documents: number;
        totalAmount: number;
      }>;
    }>(`/companies/${companyId}/dashboard/top-suppliers`),
    apiFetch<{ data: FiscalDocument[] }>(
      `/companies/${companyId}/dashboard/latest-documents`,
    ),
    apiFetch<{ data: DashboardAlert[] }>(
      `/companies/${companyId}/alerts?page=1&pageSize=4&status=open`,
    ),
  ]);
  return { summary, monthly: monthly.data, xml: xml.data, suppliers: suppliers.data, latest: latest.data, alerts: alerts.data };
}
