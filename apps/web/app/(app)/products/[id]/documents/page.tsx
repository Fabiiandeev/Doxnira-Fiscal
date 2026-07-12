"use client";

import { use } from "react";

import { ProductDocumentsView } from "@/components/products/product-documents-view";

export default function ProductDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProductDocumentsView productId={id} />;
}
