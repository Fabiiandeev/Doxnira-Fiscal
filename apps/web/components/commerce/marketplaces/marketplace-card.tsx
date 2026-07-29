import { ExternalLink, RefreshCw, Unplug, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketplaceAccount } from "@/lib/services/marketplace";

function date(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não disponível";
}

export function MarketplaceCard({
  connection,
  busy,
  onTest,
  onSync,
  onDisconnect,
}: {
  connection: MarketplaceAccount;
  busy: boolean;
  onTest: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const expiring = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime() - Date.now() < 24 * 60 * 60_000
    : false;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-subtle">Mercado Livre</p><h2 className="mt-1 text-lg font-extrabold text-ink">{connection.name}</h2><p className="text-xs text-subtle">ID externo: {connection.externalAccountId ?? "Não informado"}</p></div>
        <Badge variant={connection.status === "connected" ? (expiring ? "warning" : "success") : "danger"}>{expiring ? "Token expirando" : connection.status}</Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-subtle">Conectado em</dt><dd className="font-bold text-ink">{date(connection.connectedAt)}</dd></div>
        <div><dt className="text-xs text-subtle">Última sincronização</dt><dd className="font-bold text-ink">{date(connection.lastSyncAt)}</dd></div>
        <div><dt className="text-xs text-subtle">Anúncios</dt><dd className="font-bold text-ink">{connection.metadata?.listingsCount ?? "—"}</dd></div>
        <div><dt className="text-xs text-subtle">Pedidos</dt><dd className="font-bold text-ink">{connection.metadata?.ordersCount ?? "—"}</dd></div>
      </dl>
      {connection.metadata?.recentError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{connection.metadata.recentError}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onTest} disabled={busy}><Wifi className="h-4 w-4" />Testar conexão</Button>
        <Button size="sm" variant="lime" onClick={onSync} disabled={busy}><RefreshCw className="h-4 w-4" />Sincronizar agora</Button>
        <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy}><Unplug className="h-4 w-4" />Desconectar</Button>
        <Button asChild size="sm" variant="ghost"><a href="#historico-marketplace"><ExternalLink className="h-4 w-4" />Histórico</a></Button>
      </div>
    </Card>
  );
}
