import { AccountantOfficeView } from "@/components/accountant/accountant-office-view";

export const metadata = { title: "Ranking de Risco" };

export default function AccountantRiskRankingPage() {
  return <AccountantOfficeView kind="risk" />;
}
