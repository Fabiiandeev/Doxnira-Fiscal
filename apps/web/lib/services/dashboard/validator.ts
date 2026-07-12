import { createValidationResult } from "@/lib/services/service-architecture";
import type { PortfolioDashboard } from "@/lib/services/dashboard/types";

export function validateDashboardPayload(dashboard: Partial<PortfolioDashboard>) {
  void dashboard;
  return createValidationResult();
}
