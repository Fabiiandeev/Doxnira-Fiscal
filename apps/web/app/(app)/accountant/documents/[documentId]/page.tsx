import { AccountantDocumentDetailView } from "@/components/accountant/accountant-document-detail-view";

export default async function AccountantDocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <AccountantDocumentDetailView documentId={documentId} />;
}
