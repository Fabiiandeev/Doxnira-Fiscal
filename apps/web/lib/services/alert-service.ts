import { apiFetch } from "@/lib/api";
import type { DashboardAlert } from "./dashboard-service";

export interface AlertItem extends DashboardAlert {
  type: string;
  readAt: string | null;
  resolvedAt: string | null;
  fiscalDocument?: {
    id: string;
    accessKey: string;
    invoiceNumber: string;
    issuerName: string;
  } | null;
}

export async function listAlerts(companyId: string, status = "") {
  return apiFetch<{
    data: AlertItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(`/companies/${companyId}/alerts?pageSize=50${status ? `&status=${status}` : ""}`);
}

export function updateAlert(
  companyId: string,
  alertId: string,
  action: "read" | "resolve" | "reopen",
) {
  return apiFetch<AlertItem>(`/companies/${companyId}/alerts/${alertId}/${action}`, {
    method: "PATCH",
  });
}
