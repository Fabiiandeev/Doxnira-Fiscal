import { NfeListView } from "@/components/notas-fiscais/nfe-list-view";

export const metadata = { title: "NF-e" };

export default async function NfePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const productId = Array.isArray(params?.productId) ? params.productId[0] : params?.productId;
  return <NfeListView initialProductId={productId} />;
}
