"use client";

import { use } from "react";
import { IntelligentClientView } from "@/components/clients/intelligent-client-view";

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IntelligentClientView clientId={id} />;
}
