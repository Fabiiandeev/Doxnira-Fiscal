"use client";

import { useMemo } from "react";

import { useCompany } from "@/hooks/use-company";

export function useMarketplace() {
  const { activeCompanyId } = useCompany();

  return useMemo(
    () => ({
      companyId: activeCompanyId,
      canSyncMarketplace: Boolean(activeCompanyId),
    }),
    [activeCompanyId],
  );
}
