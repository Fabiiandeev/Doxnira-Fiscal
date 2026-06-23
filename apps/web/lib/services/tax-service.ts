import { apiFetch, getCompanyId, getToken } from "@/lib/api";
import type { CompanyTaxSettings, MonthlyClosing } from "@/lib/types";

function company() {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return companyId;
}

export function getTaxSettings(companyId = company()) {
  return apiFetch<CompanyTaxSettings | null>(`/companies/${companyId}/tax-settings`);
}

export function saveTaxSettings(settings: CompanyTaxSettings, companyId = company()) {
  return apiFetch<CompanyTaxSettings>(`/companies/${companyId}/tax-settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function repairTaxSettings(companyId = company()) {
  return apiFetch<CompanyTaxSettings>(`/companies/${companyId}/tax-settings/repair`, {
    method: "POST",
  });
}

export function listMonthlyClosings(periodYear?: number, periodMonth?: number) {
  const params = new URLSearchParams();
  if (periodYear) params.set("periodYear", String(periodYear));
  if (periodMonth) params.set("periodMonth", String(periodMonth));
  return apiFetch<{ data: MonthlyClosing[] }>(
    `/companies/${company()}/monthly-closing?${params}`,
  );
}

export function createMonthlyClosing(periodYear: number, periodMonth: number) {
  return apiFetch<MonthlyClosing>(`/companies/${company()}/monthly-closing`, {
    method: "POST",
    body: JSON.stringify({ periodYear, periodMonth }),
  });
}

export function closingAction(
  closingId: string,
  action: "recalculate" | "approve" | "reopen",
) {
  return apiFetch<MonthlyClosing>(
    `/companies/${company()}/monthly-closing/${closingId}/${action}`,
    { method: "POST" },
  );
}

export function getAccountingSummary(periodYear: number, periodMonth: number) {
  return apiFetch<{
    periodYear: number;
    periodMonth: number;
    totals: {
      inbound: number;
      outbound: number;
      freight: number;
      taxes: number;
      cancelled: number;
      missingXml: number;
      linkedCte: number;
    };
    ignoredDocuments: number;
    documents: FiscalReportDocument[];
  }>(
    `/companies/${company()}/reports/accounting-summary?periodYear=${periodYear}&periodMonth=${periodMonth}`,
  );
}

export interface FiscalReportDocument {
  documentType: string;
  operationDirection: string;
  source: string;
  accessKey: string | null;
  invoiceNumber: string | null;
  emissionDate: string | null;
  totalAmount: number;
  taxAmount: number;
  status: string | null;
  isCancelled: boolean;
  isSummary: boolean;
}

export async function downloadFiscalReport(
  kind: "monthly-closing" | "reports",
  extension: "csv" | "xlsx",
  input: { closingId?: string; periodYear?: number; periodMonth?: number },
) {
  const companyId = company();
  const token = getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
  const path =
    kind === "monthly-closing"
      ? `/companies/${companyId}/monthly-closing/${input.closingId}/export-${extension}`
      : `/companies/${companyId}/reports/export-${extension}?periodYear=${input.periodYear}&periodMonth=${input.periodMonth}`;
  const response = await fetch(`${apiUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Não foi possível exportar o relatório.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    response.headers.get("content-disposition")?.match(/filename="?([^"]+)/)?.[1] ||
    `relatorio.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
