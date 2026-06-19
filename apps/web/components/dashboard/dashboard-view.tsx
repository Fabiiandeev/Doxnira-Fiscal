"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AlertCard } from "@/components/alert-card";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { FiscalStatusBadge, XmlTypeBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompanyId } from "@/lib/api";
import { getDashboard } from "@/lib/services/dashboard-service";
import { getSyncStatus } from "@/lib/services/sync-service";
import { formatCurrency, formatDate } from "@/lib/utils";

const DashboardCharts = dynamic(
  () => import("./dashboard-charts").then((module) => module.DashboardCharts),
  {
    ssr: false,
    loading: () => <div className="mt-5 h-[620px] animate-pulse rounded-3xl bg-white/55" />,
  },
);

const metricIcons = [FileText, ShieldCheck, FileText, AlertTriangle, BellRing];

export function DashboardView() {
  const companyId = getCompanyId();
  const query = useQuery({
    queryKey: ["dashboard", companyId],
    queryFn: () => getDashboard(companyId!),
    enabled: Boolean(companyId),
    refetchInterval: 60_000,
  });
  const syncStatus = useQuery({
    queryKey: ["sync-status", companyId],
    queryFn: () => getSyncStatus(companyId!),
    enabled: Boolean(companyId),
    refetchInterval: 15_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-3xl bg-white/55" />
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/55" />
          ))}
        </div>
        <div className="h-[620px] animate-pulse rounded-3xl bg-white/55" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="grid min-h-96 place-items-center p-8 text-center">
        <div>
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-4 text-lg font-extrabold">Dashboard indisponível</h1>
          <p className="mt-2 text-xs text-subtle">{query.error?.message}</p>
          <Button className="mt-5" variant="lime" onClick={() => query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const { summary, monthly, xml, suppliers, latest, alerts } = query.data;
  const metrics = [
    {
      label: "Total NF-e",
      value: summary.documents.toLocaleString("pt-BR"),
      detail: "base fiscal indexada",
      trend: "up" as const,
      tone: "white" as const,
      href: "/documents",
    },
    {
      label: "XMLs completos",
      value: summary.fullXml.toLocaleString("pt-BR"),
      detail: "documentos processados",
      trend: "neutral" as const,
      tone: "green" as const,
      href: "/documents?xmlType=FULL",
    },
    {
      label: "XMLs resumo",
      value: summary.summaryXml.toLocaleString("pt-BR"),
      detail: "aguardando XML completo",
      trend: "neutral" as const,
      tone: "purple" as const,
      href: "/documents?xmlType=SUMMARY",
    },
    {
      label: "Canceladas",
      value: summary.cancelled.toLocaleString("pt-BR"),
      detail: "documentos cancelados",
      trend: "down" as const,
      tone: "yellow" as const,
      href: "/documents?status=CANCELLED",
    },
    {
      label: "Alertas",
      value: summary.openAlerts.toLocaleString("pt-BR"),
      detail: "itens em aberto",
      trend: "down" as const,
      tone: "cyan" as const,
      href: "/alerts",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Olá, Fabian."
        description="Dados calculados em tempo real a partir do banco fiscal da empresa selecionada."
        action={<div className="flex items-center gap-2">
          <span className="hidden text-[10px] font-bold text-subtle sm:block">
            Sync: {syncStatus.data?.latest?.syncState || "SEM FILA"}
          </span>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
        {metrics.map((metric, index) => (
          <Link key={metric.label} href={metric.href} className="transition hover:-translate-y-0.5">
            <MetricCard {...metric} icon={metricIcons[index]} />
          </Link>
        ))}
      </div>

      <DashboardCharts monthly={monthly} xml={xml} suppliers={suppliers} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.55fr]">
        <Card className="p-5 md:p-6">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-extrabold">Alertas recentes</h2>
              <p className="mt-1 text-[11px] text-subtle">Itens que exigem atenção</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/alerts">Ver todos</Link>
            </Button>
          </div>
          {alerts.length ? (
            alerts.map((alert) => (
              <Link
                href={alert.fiscalDocumentId ? `/documents/${alert.fiscalDocumentId}` : "/alerts"}
                key={alert.id}
              >
                <AlertCard
                  title={alert.title}
                  description={alert.message}
                  severity={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info"}
                  time={formatDate(alert.createdAt, true)}
                />
              </Link>
            ))
          ) : (
            <p className="rounded-2xl bg-muted p-5 text-xs text-subtle">Nenhum alerta aberto.</p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-5 md:px-6">
            <div>
              <h2 className="text-[15px] font-extrabold">Documentos recentes</h2>
              <p className="mt-1 text-[11px] text-subtle">Últimas NF-e processadas</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/documents">Ver documentos</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-muted/60 text-[9px] font-extrabold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-6 py-3">Documento</th>
                  <th className="px-4 py-3">Emitente</th>
                  <th className="px-4 py-3">Emissão</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">XML</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((document) => (
                  <tr key={document.id} className="border-t border-line text-[10px] hover:bg-muted/35">
                    <td className="px-6 py-4">
                      <Link href={`/documents/${document.id}`} className="font-extrabold hover:underline">
                        NF-e {document.invoiceNumber}
                      </Link>
                    </td>
                    <td className="max-w-48 truncate px-4 py-4 font-bold">{document.issuerName}</td>
                    <td className="px-4 py-4 text-subtle">{formatDate(document.emissionDate)}</td>
                    <td className="px-4 py-4 font-extrabold">{formatCurrency(document.totalAmount)}</td>
                    <td className="px-4 py-4"><FiscalStatusBadge status={document.status} /></td>
                    <td className="px-4 py-4"><XmlTypeBadge type={document.xmlType} /></td>
                  </tr>
                ))}
                {!latest.length && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-subtle">Nenhum documento processado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
