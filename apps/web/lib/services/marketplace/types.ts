export type MarketplaceProvider = "mercado_livre" | "shopee";

export type MarketplaceAccount = {
  id: string;
  provider: MarketplaceProvider;
  name: string;
  status: "connected" | "pending_credentials" | "disabled";
  connectedAt: string | null;
};

export type MarketplaceSyncStatus = {
  provider: MarketplaceProvider;
  status: "idle" | "queued" | "running" | "failed" | "completed";
  lastSyncAt: string | null;
};
