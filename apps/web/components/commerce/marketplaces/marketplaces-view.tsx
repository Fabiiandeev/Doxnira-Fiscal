"use client";

import { RefreshCw, Store } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMarketplaceModule } from "@/lib/services/marketplace";
import { MarketplaceCard } from "./marketplace-card";

export function MarketplacesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketplace = useMarketplaceModule();
  const { companyId, connections } = marketplace;
  const invalidate = marketplace.invalidate;
  const oauth = searchParams?.get("oauth");
  const mercadoLivre = connections.data?.find((item) => item.provider === "mercado_livre");
  const busy = marketplace.connect.isPending || marketplace.test.isPending || marketplace.sync.isPending || marketplace.disconnect.isPending;

  useEffect(() => {
    if (!oauth) return;
    notify({ title: oauth === "success" ? "Mercado Livre conectado" : "Conexão não concluída", tone: oauth === "success" ? "success" : "error" });
    void invalidate();
    router.replace("/commerce/marketplaces");
  }, [invalidate, oauth, router]);

  async function connect() {
    try {
      const result = await marketplace.connect.mutateAsync();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      notify({ title: "Não foi possível iniciar a conexão", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function action(kind: "test" | "sync" | "disconnect", connectionId: string) {
    try {
      if (kind === "test") await marketplace.test.mutateAsync(connectionId);
      if (kind === "sync") await marketplace.sync.mutateAsync(connectionId);
      if (kind === "disconnect") await marketplace.disconnect.mutateAsync(connectionId);
      notify({ title: kind === "test" ? "Conexão validada" : kind === "sync" ? "Sincronização iniciada" : "Marketplace desconectado", tone: "success" });
    } catch (error) {
      notify({ title: "Operação não concluída", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-subtle">Commerce</p><h1 className="mt-1 text-2xl font-extrabold text-ink">Marketplaces</h1><p className="mt-2 text-sm text-subtle">Gerencie conexões e sincronizações da empresa ativa.</p></div>
        <Button variant="outline" onClick={() => connections.refetch()} disabled={!companyId || connections.isFetching}><RefreshCw className={connections.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar</Button>
      </div>
      {!companyId ? <Card className="p-6 text-sm text-subtle">Selecione uma empresa para consultar as integrações.</Card>
        : connections.isLoading ? <Card className="p-6 text-sm text-subtle">Carregando conexões…</Card>
        : connections.isError ? <Card className="border-red-200 p-6"><p className="font-bold text-red-700">Não foi possível carregar as conexões.</p><p className="mt-1 text-sm text-subtle">{connections.error.message}</p></Card>
        : mercadoLivre ? <MarketplaceCard connection={mercadoLivre} busy={busy} onTest={() => action("test", mercadoLivre.id)} onSync={() => action("sync", mercadoLivre.id)} onDisconnect={() => action("disconnect", mercadoLivre.id)} />
        : <Card className="p-7"><div className="flex flex-wrap items-center justify-between gap-5"><div className="flex gap-4"><div className="rounded-xl bg-yellow-100 p-3"><Store className="h-6 w-6 text-yellow-700" /></div><div><Badge variant="neutral">Não conectado</Badge><h2 className="mt-2 font-extrabold text-ink">Mercado Livre</h2><p className="mt-1 text-sm text-subtle">Conecte sua conta para sincronizar anúncios e pedidos.</p></div></div><Button variant="lime" onClick={connect} disabled={busy}>Conectar Mercado Livre</Button></div></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {["Shopee", "Amazon"].map((provider) => <Card key={provider} className="p-6"><div className="flex items-center justify-between"><h2 className="font-extrabold text-ink">{provider}</h2><Badge variant="neutral">Em breve</Badge></div><p className="mt-2 text-sm text-subtle">A integração será disponibilizada em uma próxima versão.</p></Card>)}
      </div>
      <div id="historico-marketplace" className="scroll-mt-20"><Card className="p-6"><h2 className="font-extrabold text-ink">Histórico</h2><p className="mt-2 text-sm text-subtle">Os eventos de sincronização ficam registrados pela API e serão exibidos aqui quando houver atividade.</p></Card></div>
    </div>
  );
}
