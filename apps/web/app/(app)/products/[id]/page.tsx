"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { IntelligentProductView } from "@/components/products/intelligent-product-view";
import { Loader2 } from "lucide-react";

function ProductPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const mode: "edit" | "view" = searchParams?.get("edit") === "1" ? "edit" : "view";
  return <IntelligentProductView productId={id} viewMode={mode} />;
}

export default function ViewProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-subtle" /></div>}>
      <ProductPageInner id={id} />
    </Suspense>
  );
}
