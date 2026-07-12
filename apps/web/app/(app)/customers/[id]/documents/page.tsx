"use client";

import { use } from "react";

import { CustomerDocumentsView } from "@/components/clients/customer-documents-view";

export default function CustomerDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerDocumentsView customerId={id} />;
}
