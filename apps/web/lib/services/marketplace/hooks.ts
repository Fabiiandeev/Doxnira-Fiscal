"use client";

import { useMemo } from "react";

import { useMarketplace } from "@/hooks/use-marketplace";
import { getMarketplaceModuleStatus } from "@/lib/services/marketplace/service";

export function useMarketplaceModule() {
  const marketplace = useMarketplace();
  const status = useMemo(() => getMarketplaceModuleStatus(), []);

  return {
    ...marketplace,
    status,
  };
}
