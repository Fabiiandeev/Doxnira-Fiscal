import { MdfeFormView } from "@/components/mdfe/mdfe-form-view";

export default async function EditMdfePage({ params }: { params: Promise<{ mdfeId: string }> }) {
  const { mdfeId } = await params;
  return <MdfeFormView mdfeId={mdfeId} />;
}
