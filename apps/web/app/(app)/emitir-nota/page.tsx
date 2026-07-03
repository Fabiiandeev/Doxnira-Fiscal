import { EmitirNotaView } from "@/components/emitir-nota/emitir-nota-view";
import { redirect } from "next/navigation";

export const metadata = { title: "Emitir Nota" };

export default async function EmitirNotaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (!params?.id) redirect("/notas-fiscais");
  const nfeId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <EmitirNotaView nfeId={nfeId} />;
}
