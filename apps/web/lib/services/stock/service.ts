import type { ServiceModuleStatus } from "@/lib/services/service-architecture";

export const stockEndpoints = {
  items: "/stock",
  movements: "/stock/movements",
  intelligence: "/stock/intelligence",
} as const;

export function getStockModuleStatus(): ServiceModuleStatus {
  return {
    status: "in_development",
    message: "Estrutura de estoque preparada para endpoints oficiais.",
  };
}
