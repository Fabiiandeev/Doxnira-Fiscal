import { createValidationResult } from "@/lib/services/service-architecture";
import type { MarketplaceAccount } from "@/lib/services/marketplace/types";

export function validateMarketplaceAccountDraft(account: Partial<MarketplaceAccount>) {
  void account;
  return createValidationResult();
}
