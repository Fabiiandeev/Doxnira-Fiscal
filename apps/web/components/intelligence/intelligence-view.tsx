"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Brain, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SmartMetricCard } from "@/components/smart/smart-metric-card";
import { notify } from "@/components/toast-viewport";
import { useIntelligence, useIntelligenceAction } from "@/lib/services/intelligence";
import type { Benchmark, CommerceIntelligence, FiscalIntelligence, Insight } from "@/lib/services/intelligence";

type Kind = "fiscal" | "commerce" | "insights" | "decisions" | "benchmark";
const titles: Record<Kind, [string, string]> = {
  fiscal: ["Fiscal Intelligence", "Indicadores fiscais calculados a partir dos documentos reais da empresa."],
  commerce: ["Commerce Intelligence", "Vendas, custos e operação dos marketplaces conectados."],
  insights: ["Doxnira Insights", "Alertas acionáveis gerados exclusivamente a partir dos dados operacionais."],
  decisions: ["Centro de Decisão", "Fila priorizada com evidências, responsáveis e histórico auditável."],
  benchmark: ["Benchmark", "Comparação interna com o período anterior, sem dados externos estimados."],
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

function Filters({ from, to, setFrom, setTo, refresh, fetching }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  refresh: () => void; fetching: boolean;
}) {
  return <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
    <label className="text-xs font-bold text-subtle">De<input aria-label="Data inicial" className="mt-1 block rounded-xl border p-2 text-ink" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
    <label className="text-xs font-bold text-subtle">Até<input aria-label="Data final" className="mt-1 block rounded-xl border p-2 text-ink" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
    <Button variant="outline" onClick={refresh} disabled={fetching}><RefreshCw className={`mr-2 h-4 w-4 ${fetching ? "animate-spin" : ""}`} />Atualizar</Button>
  </Card>;
}

function State({ error, retry }: { error: Error; retry: () => void }) {
  return <Card className="p-8 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" /><p className="font-bold">Não foi possível carregar os dados</p><p className="my-3 text-sm text-subtle">{error.message}</p><Button onClick={retry}>Tentar novamente</Button></Card>;
}

function Fiscal({ data }: { data: FiscalIntelligence }) {
  const [page, setPage] = useState(1); const perPage = 10;
  const rows = data.documents.slice((page - 1) * perPage, page * perPage);
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SmartMetricCard label="NF-e emitidas" value={data.metrics.nfeIssued} icon={BarChart3} />
      <SmartMetricCard label="NF-e de entrada" value={data.metrics.nfeInbound} />
      <SmartMetricCard label="CT-e / MDF-e" value={`${data.metrics.cte} / ${data.metrics.mdfe}`} />
      <SmartMetricCard label="Impostos previstos" value={currency.format(data.metrics.estimatedTax)} />
      <SmartMetricCard label="Rejeições" value={data.metrics.rejections} tone={data.metrics.rejections ? "danger" : "success"} />
      <SmartMetricCard label="Pendências" value={data.metrics.pending} tone={data.metrics.pending ? "warning" : "success"} />
      <SmartMetricCard label="Risco fiscal" value={`${data.risk}/100`} tone={data.risk > 40 ? "danger" : "success"} />
      <SmartMetricCard label="Certificado" value={data.certificate ? new Date(data.certificate.validUntil).toLocaleDateString("pt-BR") : "Não configurado"} />
    </div>
    <Card className="p-5"><h2 className="font-extrabold">Ranking de entradas por fornecedor</h2>{data.ranking.length ? <div className="mt-4 space-y-3">{data.ranking.map((r) => <div key={r.name}><div className="flex justify-between text-sm"><span>{r.name}</span><b>{currency.format(r.value)}</b></div><div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-lime-500" style={{ width: `${Math.max(4, r.value / data.ranking[0].value * 100)}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-subtle">Nenhuma entrada real encontrada no período.</p>}</Card>
    <DataTable headers={["Documento", "Tipo", "Direção", "Emissão", "Valor"]} rows={rows.map((d) => [d.invoiceNumber || "Sem número", d.documentType, d.operationDirection, d.emissionDate ? new Date(d.emissionDate).toLocaleDateString("pt-BR") : "—", currency.format(d.totalAmount)])} page={page} pages={Math.max(1, Math.ceil(data.documents.length / perPage))} setPage={setPage} />
  </div>;
}

function Commerce({ data }: { data: CommerceIntelligence }) {
  const [page, setPage] = useState(1); const perPage = 10;
  const rows = data.orders.slice((page - 1) * perPage, page * perPage);
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <SmartMetricCard label="Pedidos" value={data.metrics.orders} /><SmartMetricCard label="Vendas" value={currency.format(data.metrics.sales)} />
    <SmartMetricCard label="Custos" value={currency.format(data.metrics.costs)} /><SmartMetricCard label="Frete" value={currency.format(data.metrics.freight)} />
    <SmartMetricCard label="Lucro calculado" value={currency.format(data.metrics.profit)} tone={data.metrics.profit < 0 ? "danger" : "success"} />
    <SmartMetricCard label="Margem" value={`${number.format(data.metrics.margin)}%`} /><SmartMetricCard label="Cancelamentos" value={data.metrics.cancellations} />
    <SmartMetricCard label="Contas conectadas" value={data.metrics.connectedAccounts} />
  </div><DataTable headers={["Pedido", "Status", "Data", "Total"]} rows={rows.map((o) => [o.providerOrderId, o.status, new Date(o.orderedAt).toLocaleDateString("pt-BR"), currency.format(o.totalAmount)])} page={page} pages={Math.max(1, Math.ceil(data.orders.length / perPage))} setPage={setPage} /></div>;
}

function Actions({ items, kind }: { items: Insight[]; kind: "insights" | "decisions" }) {
  const router = useRouter(); const mutation = useIntelligenceAction();
  const act = async (item: Insight, action: string) => {
    let justification: string | undefined; let assignee: string | undefined;
    if (["IGNORED", "REJECTED", "REVIEW_REQUESTED"].includes(action)) {
      justification = window.prompt("Informe a justificativa:")?.trim() || undefined;
      if (!justification) return;
    }
    if (action === "ASSIGNED") { assignee = window.prompt("Responsável:")?.trim() || undefined; if (!assignee) return; }
    try { await mutation.mutateAsync({ kind, key: item.key, action, justification, assignee }); notify({ title: "Ação registrada", description: "A operação foi salva na auditoria." }); }
    catch (error) { notify({ title: "Falha na ação", description: error instanceof Error ? error.message : "Tente novamente." }); }
  };
  if (!items.length) return <Card className="p-8 text-center"><Zap className="mx-auto mb-3 h-8 w-8 text-lime-600" /><p className="font-bold">Nenhuma ocorrência no período</p><p className="text-sm text-subtle">Os dados reais não geraram insights pendentes.</p></Card>;
  return <div className="space-y-3">{items.map((item) => <Card key={item.key} className="p-5"><div className="flex flex-wrap justify-between gap-4"><div><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{item.priority || item.severity}</span><h2 className="mt-3 font-extrabold">{item.title}</h2><p className="mt-1 text-sm text-subtle">{item.evidence || `${item.count} ocorrência(s)`} · Status: {item.status}</p>{item.assignee && <p className="text-xs text-subtle">Responsável: {item.assignee}</p>}</div><div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" onClick={() => router.push(item.href)}>Abrir contexto</Button>
    <Button size="sm" onClick={() => act(item, kind === "insights" ? "ANALYZED" : "ACCEPTED")}>{kind === "insights" ? "Analisado" : "Aceitar"}</Button>
    <Button size="sm" variant="outline" onClick={() => act(item, "ASSIGNED")}>Atribuir</Button>
    {kind === "insights" ? <><Button size="sm" variant="outline" onClick={() => act(item, "EXECUTED")}>Executar</Button><Button size="sm" variant="outline" onClick={() => act(item, "IGNORED")}>Ignorar</Button></> : <><Button size="sm" variant="outline" onClick={() => act(item, "REVIEW_REQUESTED")}>Revisão</Button><Button size="sm" variant="outline" onClick={() => act(item, "REJECTED")}>Rejeitar</Button></>}
  </div></div>{item.timeline?.length ? <div className="mt-4 border-t pt-3 text-xs text-subtle">{item.timeline.map((t, i) => <p key={`${t.at}-${i}`}>{new Date(t.at).toLocaleString("pt-BR")} · {t.action}{t.justification ? ` · ${t.justification}` : ""}</p>)}</div> : null}</Card>)}</div>;
}

function BenchmarkView({ data }: { data: Benchmark }) {
  if (!data.sufficientData) return <Card className="p-8 text-center"><TrendingUp className="mx-auto mb-3 h-8 w-8" /><p className="font-bold">Dados insuficientes para comparação</p><p className="text-sm text-subtle">Importe ou sincronize documentos reais em pelo menos um dos períodos.</p></Card>;
  const labels: Record<string, string> = { revenue: "Faturamento", rejections: "Rejeições", pending: "Pendências", fiscalScore: "Score fiscal" };
  return <div className="grid gap-4 md:grid-cols-2">{Object.entries(data.metrics).map(([key, metric]) => <Card key={key} className="p-5"><p className="text-sm font-bold">{labels[key]}</p><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-subtle">Período atual</p><p className="text-2xl font-extrabold">{key === "revenue" ? currency.format(metric.current) : number.format(metric.current)}</p></div><div className="text-right"><p className="text-xs text-subtle">Anterior</p><p className="font-bold">{key === "revenue" ? currency.format(metric.previous) : number.format(metric.previous)}</p><p className="text-xs">{metric.variation == null ? "Sem base anterior" : `${metric.variation >= 0 ? "+" : ""}${number.format(metric.variation)}%`}</p></div></div></Card>)}</div>;
}

function DataTable({ headers, rows, page = 1, pages = 1, setPage }: { headers: string[]; rows: Array<Array<string | number>>; page?: number; pages?: number; setPage?: (p: number) => void }) {
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left">{headers.map((h) => <th key={h} className="p-3">{h}</th>)}</thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="p-8 text-center text-subtle">Nenhum dado real encontrado.</td></tr>}</tbody></table></div>{pages > 1 && <div className="flex items-center justify-end gap-2 border-t p-3"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage?.(page - 1)}>Anterior</Button><span className="text-xs">{page} de {pages}</span><Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage?.(page + 1)}>Próxima</Button></div>}</Card>;
}

export function IntelligenceView({ kind }: { kind: Kind }) {
  const [from, setFrom] = useState(monthStart); const [to, setTo] = useState(today);
  const filters = useMemo(() => ({ from, to }), [from, to]);
  const result = useIntelligence(kind, filters);
  const [title, description] = titles[kind];
  return <><PageHeader eyebrow="Inteligência" title={title} description={description} icon={Brain} /><Filters from={from} to={to} setFrom={setFrom} setTo={setTo} refresh={() => result.refetch()} fetching={result.isFetching} />
    {result.isLoading ? <Card className="animate-pulse p-12 text-center text-subtle">Carregando dados reais…</Card> : result.error ? <State error={result.error} retry={() => result.refetch()} /> : kind === "fiscal" ? <Fiscal data={result.data as FiscalIntelligence} /> : kind === "commerce" ? <Commerce data={result.data as CommerceIntelligence} /> : kind === "insights" ? <Actions items={result.data as Insight[]} kind="insights" /> : kind === "decisions" ? <Actions items={result.data as Insight[]} kind="decisions" /> : <BenchmarkView data={result.data as Benchmark} />}</>;
}
