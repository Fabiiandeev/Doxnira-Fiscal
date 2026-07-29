export type MarketplaceProvider = "mercado_livre" | "shopee" | string;

export type MarketplaceAccount = {
  id: string;
  provider: MarketplaceProvider;
  name: string;
  status: "connected" | "pending_credentials" | "disabled";
  connectedAt: string | null;
  externalAccountId: string | null;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  metadata?: {
    listingsCount?: number;
    ordersCount?: number;
    recentError?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceTestResult = {
  success: boolean;
  accountId: string;
  nickname: string | null;
};

export type MarketplaceSyncStatus = {
  provider: MarketplaceProvider;
  status: "idle" | "queued" | "running" | "failed" | "completed";
  lastSyncAt: string | null;
};
