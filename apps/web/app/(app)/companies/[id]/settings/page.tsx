import { CompanySettingsView } from "@/components/companies/company-settings-view";

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanySettingsView companyId={id} />;
}
