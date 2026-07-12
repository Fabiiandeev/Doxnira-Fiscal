import { headers } from "next/headers";

import { EmitirNotaView } from "@/components/emitir-nota/emitir-nota-view";
import { NfeListView } from "@/components/notas-fiscais/nfe-list-view";
import type { IntelligentClient } from "@/lib/client-types";
import type { NfeDocumentDetail } from "@/lib/nfe-types";
import type { Cfop, Product } from "@/lib/product-types";

export const metadata = { title: "Emitir Nota" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

type EmitirNotaBootstrapData = {
  note: NfeDocumentDetail;
  cfops: Cfop[];
  clients: IntelligentClient[];
  products: Product[];
};

async function fetchJson<T>(path: string, token: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Nao foi possivel carregar os dados da NF-e.");
  }

  return payload as T;
}

async function readBootstrapSession() {
  const headerStore = await headers();
  const token = headerStore.get("x-ns-session-token");
  const companyId = headerStore.get("x-ns-session-company-id");
  return { token, companyId };
}

async function loadEmitirNotaBootstrap(nfeId: string): Promise<EmitirNotaBootstrapData | null> {
  const session = await readBootstrapSession();
  if (!session.token || !session.companyId) return null;

  const [noteResponse, cfopResponse, clientResponse, productResponse] = await Promise.all([
    fetchJson<{ data: NfeDocumentDetail }>(`/companies/${session.companyId}/nfe/${nfeId}`, session.token),
    fetchJson<{ data: Cfop[] }>(`/companies/${session.companyId}/cfops/search?limit=50`, session.token),
    fetchJson<{ data: IntelligentClient[] }>(`/companies/${session.companyId}/clients/search?limit=25`, session.token),
    fetchJson<{ data: Product[] }>(`/companies/${session.companyId}/products/search?limit=25`, session.token),
  ]);

  return {
    note: noteResponse.data,
    cfops: cfopResponse.data ?? [],
    clients: clientResponse.data ?? [],
    products: productResponse.data ?? [],
  };
}

export default async function EmitirNotaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const productId = Array.isArray(params?.productId) ? params.productId[0] : params?.productId;
  if (!params?.id) {
    return <NfeListView initialProductId={productId} />;
  }
  const nfeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const bootstrap = await loadEmitirNotaBootstrap(nfeId).catch(() => null);

  return (
    <EmitirNotaView
      nfeId={nfeId}
      initialProductId={productId}
      initialNote={bootstrap?.note ?? null}
      initialCfops={bootstrap?.cfops ?? []}
      initialClients={bootstrap?.clients ?? []}
      initialProducts={bootstrap?.products ?? []}
    />
  );
}
