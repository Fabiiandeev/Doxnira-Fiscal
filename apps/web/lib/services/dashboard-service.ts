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

export interface PortfolioDashboard {
  companies: Array<{
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    revenue: number;
    estimatedTax: number;
    pendingCount: number;
    closingStatus: string;
    lastSyncAt: string | null;
  }>;
  kpis: {
    companies: number;
    ready: number;
    pending: number;
    rejectedNotes: number;
    expiringCertificates: number;
    estimatedTax: number;
  };
  pendingByType: Array<{ type: string; count: number }>;
}

export async function getDashboard(companyId: string) {
  const [portfolio, fiscal, taxes, monthly, latest, alerts] = await Promise.all([
    apiFetch<PortfolioDashboard>("/companies/portfolio/dashboard"),
    apiFetch<{
      inbound: { count: number; total: number };
      outbound: { count: number; total: number };
      cteInbound: { count: number; total: number };
      cteOutbound: { count: number; total: number };
      cancelled: number;
      missingFullXml: number;
      estimatedTax: number;
    }>(`/companies/${companyId}/dashboard/fiscal-summary`),
    apiFetch<{
      total: number;
      definitive: boolean;
      data: Array<{ name: string; value: number; color: string }>;
    }>(`/companies/${companyId}/dashboard/tax-summary`),
    apiFetch<{ data: Array<{ month: string; inbound: number; outbound: number }> }>(
      `/companies/${companyId}/dashboard/monthly-tax-flow`,
    ),
    apiFetch<{ data: FiscalDocument[] }>(`/companies/${companyId}/dashboard/latest-documents`),
    apiFetch<{ data: DashboardAlert[] }>(
      `/companies/${companyId}/alerts?page=1&pageSize=4&status=open`,
    ),
  ]);
  return {
    portfolio,
    fiscal,
    taxes,
    monthly: monthly.data,
    latest: latest.data,
    alerts: alerts.data,
  };
}
