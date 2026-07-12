import { NfeListView } from "@/components/notas-fiscais/nfe-list-view";

export const metadata = { title: "Notas Fiscais" };

export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const productId = Array.isArray(params?.productId) ? params.productId[0] : params?.productId;
  return <NfeListView initialProductId={productId} />;
}
