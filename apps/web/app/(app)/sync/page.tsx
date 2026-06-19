import type { Metadata } from "next";

import { SyncView } from "@/components/sync/sync-view";

export const metadata: Metadata = { title: "Sincronização" };

export default function SyncPage() {
  return <SyncView />;
}

