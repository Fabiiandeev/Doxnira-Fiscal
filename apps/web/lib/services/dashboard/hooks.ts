"use client";

import { useQuery } from "@tanstack/react-query";

import { useCompany } from "@/hooks/use-company";
import { getDashboard } from "@/lib/services/dashboard/service";

export function useDashboard() {
  const { activeCompanyId } = useCompany();

  return useQuery({
    queryKey: ["dashboard", activeCompanyId],
    queryFn: () => getDashboard(activeCompanyId ?? ""),
    enabled: Boolean(activeCompanyId),
  });
}
