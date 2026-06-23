import type { Metadata } from "next";

import { MonthlyClosingView } from "@/components/reports/monthly-closing-view";

export const metadata: Metadata = { title: "Fechamento fiscal mensal" };

export default function MonthlyClosingPage() {
  return <MonthlyClosingView />;
}
