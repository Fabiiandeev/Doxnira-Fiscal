import { FinancialAccountForm } from "@/components/financial/accounts/accounts-ui";
export const metadata = { title: "Editar conta financeira | NS Fiscal Cloud" };
export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <FinancialAccountForm accountId={accountId} />;
}
