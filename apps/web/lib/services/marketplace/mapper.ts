import { mapIdentity } from "@/lib/services/service-architecture";
import type {
  MarketplaceAccount,
  MarketplaceSyncStatus,
} from "@/lib/services/marketplace/types";

export const mapMarketplaceAccount = mapIdentity<MarketplaceAccount>;
export const mapMarketplaceSyncStatus = mapIdentity<MarketplaceSyncStatus>;
