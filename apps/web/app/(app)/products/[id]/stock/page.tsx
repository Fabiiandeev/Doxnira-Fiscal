"use client";

import { use } from "react";

import { IntelligentProductView } from "@/components/products/intelligent-product-view";

export default function ProductStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IntelligentProductView productId={id} viewMode="edit" initialTab="estoque" />;
}
