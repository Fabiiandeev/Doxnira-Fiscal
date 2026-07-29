import type { Metadata } from "next";

import { MarketplacesView } from "@/components/commerce/marketplaces/marketplaces-view";

export const metadata: Metadata = { title: "Marketplaces" };

export default function MarketplacesPage() {
  return <MarketplacesView />;
}
