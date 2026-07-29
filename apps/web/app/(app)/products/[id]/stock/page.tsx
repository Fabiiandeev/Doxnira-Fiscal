"use client";

import { use } from "react";
import Link from "next/link";

import { IntelligentProductView } from "@/components/products/intelligent-product-view";

export default function ProductStockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 text-sm font-semibold">
      <Link className="rounded-lg border px-3 py-2" href={`/operacao/estoque?productId=${id}`}>Consultar saldo</Link>
      <Link className="rounded-lg border px-3 py-2" href={`/operacao/estoque/movimentos?productId=${id}`}>Consultar movimentos</Link>
      <Link className="rounded-lg border px-3 py-2" href={`/operacao/estoque/reservas?productId=${id}`}>Consultar reservas</Link>
    </div>
    <IntelligentProductView productId={id} viewMode="edit" initialTab="estoque" />
  </div>;
}
