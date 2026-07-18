import { TransportDocumentDetailView } from "@/components/accountant/transport-documents/transport-document-detail-view";
export default async function Page({ params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params; return <TransportDocumentDetailView documentId={documentId} />; }
