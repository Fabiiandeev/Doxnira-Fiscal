import { MdfeDetailView } from "@/components/mdfe/mdfe-detail-view";

export default async function MdfeDetailPage({ params }: { params: Promise<{ mdfeId: string }> }) {
  const { mdfeId } = await params;
  return <MdfeDetailView mdfeId={mdfeId} />;
}
