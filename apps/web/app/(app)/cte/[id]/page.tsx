import { CteDetailView } from "@/components/cte/cte-detail-view";

export default async function CteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CteDetailView id={id} />;
}
