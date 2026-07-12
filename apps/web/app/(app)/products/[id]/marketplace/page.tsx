"use client";

import { use } from "react";

import { IntelligentProductView } from "@/components/products/intelligent-product-view";

export default function ProductMarketplacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IntelligentProductView productId={id} viewMode="edit" initialTab="marketplace" />;
}
