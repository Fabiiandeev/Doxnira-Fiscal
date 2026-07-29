import { apiFetch, getCompanyId } from "@/lib/api";
import type { DashboardData } from "./operation-dashboard-types";
export const getOperationDashboard = (query = "") => {
  const companyId = getCompanyId(); if (!companyId) throw new Error("Selecione uma empresa.");
  return apiFetch<DashboardData>(`/companies/${companyId}/operation/dashboard${query ? `?${query}` : ""}`);
};
