import { AccountantOfficeView } from "@/components/accountant/accountant-office-view";

export const metadata = { title: "Relatorio de Valor" };

export default function AccountantValueReportPage() {
  return <AccountantOfficeView kind="value" />;
}
