"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { IntelligentClientView } from "@/components/clients/intelligent-client-view";
import { Loader2 } from "lucide-react";

function ClientPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const mode: "edit" | "view" = searchParams?.get("edit") === "1" ? "edit" : "view";
  return <IntelligentClientView clientId={id} viewMode={mode} />;
}

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-subtle" /></div>}>
      <ClientPageInner id={id} />
    </Suspense>
  );
}
