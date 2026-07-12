"use client";

import { useMemo } from "react";

import { getStockModuleStatus } from "@/lib/services/stock/service";

export function useStockModule() {
  return useMemo(() => getStockModuleStatus(), []);
}
