import { CompanyDetailView } from "@/components/companies/company-detail-view";

export default async function CompanyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanyDetailView id={id} />;
}
