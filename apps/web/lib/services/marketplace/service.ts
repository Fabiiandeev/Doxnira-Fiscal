import { apiFetch } from "@/lib/api";
import type { ServiceModuleStatus } from "@/lib/services/service-architecture";
import type { MarketplaceAccount, MarketplaceTestResult } from "@/lib/services/marketplace/types";

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

export async function listMarketplaceConnections(
  companyId: string,
): Promise<MarketplaceAccount[]> {
  return apiFetch<MarketplaceAccount[]>(
    `/companies/${encodeURIComponent(companyId)}/commerce/marketplaces`,
  );
}

function connectionPath(companyId: string, connectionId: string, action = "") {
  return `/companies/${encodeURIComponent(companyId)}/commerce/marketplaces/${encodeURIComponent(connectionId)}${action}`;
}

export async function beginMercadoLivreConnection(companyId: string) {
  return apiFetch<{ authorizationUrl: string }>(
    `/companies/${encodeURIComponent(companyId)}/commerce/marketplaces/mercado-livre/connect`,
  );
}

export function testMarketplaceConnection(companyId: string, connectionId: string) {
  return apiFetch<MarketplaceTestResult>(connectionPath(companyId, connectionId, "/test"), { method: "POST" });
}

export function syncMarketplaceConnection(companyId: string, connectionId: string) {
  return apiFetch<{ id: string; status: string }>(connectionPath(companyId, connectionId, "/sync"), {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
  });
}

export async function disconnectMarketplaceConnection(companyId: string, connectionId: string) {
  await apiFetch(connectionPath(companyId, connectionId, "/disconnect"), { method: "POST" });
}
