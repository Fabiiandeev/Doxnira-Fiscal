import { CompanyFiscalView } from "@/components/companies/company-fiscal-view";

export default async function CompanyFiscalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanyFiscalView companyId={id} />;
}
