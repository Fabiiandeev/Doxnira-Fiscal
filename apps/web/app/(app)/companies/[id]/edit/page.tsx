import { CompanyFormView } from "@/components/companies/company-form-view";

export default async function CompanyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanyFormView companyId={id} />;
}
