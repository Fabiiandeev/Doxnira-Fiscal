import Link from "next/link";
import { ArrowRight, FileClock, FileArchive, LayoutDashboard, RefreshCw } from "lucide-react";

import { FiscalAuditTrail } from "@/components/fiscal/fiscal-audit-trail";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fiscalRouteCards } from "@/lib/fiscal-route-map";

export function FiscalHubView() {
  const readyCount = fiscalRouteCards.filter((card) => card.status === "ready").length;
  const scaffoldCount = fiscalRouteCards.filter((card) => card.status === "scaffold").length;

  return (
    <div className="space-y-5">
      <PageHeader
      eyebrow="Base fiscal"
      title="Central Fiscal"
      description="Portal de entrada da arquitetura fiscal com rotas consolidadas, validacao compartilhada e trilha de auditoria."
      icon={LayoutDashboard}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/xml-fiscal">
                <FileArchive className="h-4 w-4" />
                XML Fiscal
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/fechamento-fiscal">
                <FileClock className="h-4 w-4" />
                Fechamento
              </Link>
            </Button>
            <Button asChild variant="lime">
              <Link href="/nfe">
                <ArrowRight className="h-4 w-4" />
                Abrir NF-e
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-subtle">
            Rotas prontas
          </p>
          <p className="mt-2 text-2xl font-extrabold text-ink">{readyCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-subtle">
            Estruturas base
          </p>
          <p className="mt-2 text-2xl font-extrabold text-ink">{scaffoldCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-subtle">
            Motor de validacao
          </p>
          <p className="mt-2 text-2xl font-extrabold text-ink">Compartilhado</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-subtle">
            Auditoria
          </p>
          <p className="mt-2 text-2xl font-extrabold text-ink">Persistente</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
              Mapa da arquitetura
            </p>
            <h2 className="mt-1 text-base font-extrabold text-ink">Menu Fiscal organizado por dominio</h2>
          </div>
          <Badge variant="outline">{fiscalRouteCards.length} rotas registradas</Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fiscalRouteCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.key} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-muted">
                    <Icon className="h-5 w-5 text-ink" />
                  </div>
                  <Badge variant={card.status === "ready" ? "success" : "warning"}>
                    {card.statusLabel}
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-extrabold text-ink">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-subtle">{card.description}</p>
                <div className="mt-4 space-y-2">
                  {card.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-2 text-[11px] font-semibold text-subtle">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                      {highlight}
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-5 w-full" variant={card.status === "ready" ? "lime" : "outline"}>
                  <Link href={card.href}>
                    <ArrowRight className="h-4 w-4" />
                    {card.actionLabel}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      </Card>

      <FiscalAuditTrail />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-subtle">
            Sprint 1
          </p>
          <p className="mt-1 text-sm text-subtle">
            Base visual, rotas e servicos compartilhados preparados para as proximas etapas do menu fiscal.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/documents">
            <RefreshCw className="h-4 w-4" />
            Ir para documentos
          </Link>
        </Button>
      </Card>
    </div>
  );
}
