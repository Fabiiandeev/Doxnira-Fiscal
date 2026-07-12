"use client";

import { Suspense, use } from "react";
import { Loader2 } from "lucide-react";

import { IntelligentClientView } from "@/components/clients/intelligent-client-view";

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-subtle" /></div>}>
      <IntelligentClientView clientId={id} viewMode="edit" />
    </Suspense>
  );
}
