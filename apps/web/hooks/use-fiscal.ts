"use client";

import { useMemo } from "react";

import { useCompany } from "@/hooks/use-company";

export function useFiscal() {
  const { activeCompany, activeCompanyId } = useCompany();

  return useMemo(
    () => ({
      companyId: activeCompanyId,
      environment: activeCompany?.environment ?? "homologation",
      hasActiveCompany: Boolean(activeCompanyId),
    }),
    [activeCompany?.environment, activeCompanyId],
  );
}
