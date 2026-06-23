import type { Metadata } from "next";

import { AccountingReportsView } from "@/components/reports/accounting-reports-view";

export const metadata: Metadata = { title: "Relatórios contábeis" };

export default function AccountingReportsPage() {
  return <AccountingReportsView />;
}
