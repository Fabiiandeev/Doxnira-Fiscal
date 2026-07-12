import type { ServiceModuleStatus } from "@/lib/services/service-architecture";

export const marketplaceEndpoints = {
  accounts: "/marketplaces/accounts",
  mercadoLivre: "/marketplaces/mercado-livre",
  shopee: "/marketplaces/shopee",
  sync: "/marketplaces/sync",
  webhooks: "/marketplaces/webhooks",
} as const;

export function getMarketplaceModuleStatus(): ServiceModuleStatus {
  return {
    status: "not_connected",
    message: "Integrações oficiais preparadas para credenciais OAuth.",
  };
}
