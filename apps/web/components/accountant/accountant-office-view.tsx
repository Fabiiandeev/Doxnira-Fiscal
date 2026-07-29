"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAccountantCompanies, type AccountantCompany } from "@/lib/services/accountant-documents-service";
import { useAccountantOfficeData, useQueueAction } from "@/lib/services/accountant/hooks";
import type { QueueItem, RiskItem } from "@/lib/services/accountant/types";

const titles = { dashboard: ["Dashboard Contador", "Visão real da carteira contábil."], risk: ["Ranking de Risco", "Risco determinístico e evidências por empresa."], queue: ["Fila Fiscal", "Tratamento rastreável das pendências fiscais."], value: ["Relatório de Valor", "Entregas reais do escritório, sem estimativas financeiras."] } as const;
export function AccountantOfficeView({ kind }: { kind: keyof typeof titles }) {
  const companies = useQuery({ queryKey: ["accountant", "companies"], queryFn: listAccountantCompanies });
  const [selected, setSelected] = useState<AccountantCompany | null>(null); const context = selected ?? companies.data?.data[0] ?? null;
  const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const result = useAccountantOfficeData(kind, context?.office.id || "", { companyId: context?.company.id, status, page });
  const action = useQueueAction(context?.office.id || "");
  const data = result.data as Record<string, unknown> | undefined;
  return <>
    <PageHeader eyebrow="Contabilidade" title={titles[kind][0]} description={titles[kind][1]} />
    <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
      <label className="text-xs font-bold">Empresa autorizada</label>
      <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={context ? `${context.office.id}:${context.company.id}` : ""} onChange={(e) => { setSelected(companies.data?.data.find((c) => `${c.office.id}:${c.company.id}` === e.target.value) || null); setPage(1); }}>
        {companies.data?.data.map((c) => <option key={`${c.office.id}:${c.company.id}`} value={`${c.office.id}:${c.company.id}`}>{c.company.tradeName || c.company.legalName} · {c.office.name}</option>)}
      </select>
      {kind === "queue" && <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todos os status</option>{["OPEN","ASSIGNED","IN_PROGRESS","WAITING_COMPANY","WAITING_ACCOUNTANT","RESOLVED","DISMISSED","REOPENED"].map((s) => <option key={s}>{s}</option>)}</select>}
      <Button variant="outline" onClick={() => result.refetch()}>Atualizar dados</Button>
    </Card>
    {!context ? <Card className="p-8">Nenhuma empresa vinculada.</Card> : result.isLoading ? <div className="grid gap-3 md:grid-cols-3">{[1,2,3].map((i) => <Card key={i} className="h-28 animate-pulse bg-slate-100" />)}</div> : result.isError ? <Card className="p-8"><p>Não foi possível carregar os dados.</p><Button onClick={() => result.refetch()}>Tentar novamente</Button></Card> :
      kind === "risk" ? <RiskList items={(data?.items || []) as RiskItem[]} /> :
      kind === "queue" ? <QueueList items={(data?.items || []) as QueueItem[]} run={(id,a,body) => action.mutate({ id, action:a, body })} pending={action.isPending} /> :
      <MetricView data={data || {}} />}
    {kind === "queue" && <div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" onClick={() => setPage(page + 1)}>Próxima</Button></div>}
  </>;
}
function MetricView({ data }: { data: Record<string, unknown> }) {
  const metrics = (data.indicators || data.current || {}) as Record<string, unknown>;
  const labels: Record<string,string> = { linkedCompanies:"Empresas vinculadas", documents:"Documentos", awaitingReview:"Aguardando conferência", openRequests:"Solicitações abertas", pendingGuides:"Guias pendentes", expiringCertificates:"Certificados vencendo", rejections:"Rejeições", averageRisk:"Risco médio", documentsProcessed:"Documentos processados", documentsReviewed:"Documentos conferidos", requestsResolved:"Solicitações resolvidas", closingsCompleted:"Fechamentos concluídos", fiscalPreparationsCompleted:"SPED/SINTEGRA concluídos", companiesServed:"Empresas atendidas", certificatesMonitored:"Certificados monitorados", occurrencesResolved:"Ocorrências resolvidas" };
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(metrics).map(([k,v]) => <Card key={k} className="p-5"><p className="text-xs text-subtle">{labels[k] || k}</p><p className="mt-2 text-3xl font-extrabold">{String(v ?? 0)}</p></Card>)}</div>;
}
function RiskList({ items }: { items: RiskItem[] }) { return <div className="space-y-3">{items.length ? items.map((item) => <Card key={item.companyId} className="p-5"><div className="flex justify-between"><div><h3 className="font-bold">{item.companyName}</h3><p className="text-sm text-subtle">{item.factors.map((f) => `${f.key}: ${f.count}`).join(" · ") || "Sem fatores de risco"}</p></div><div className="text-right"><p className="text-3xl font-extrabold">{item.score}</p><Badge>{item.classification}</Badge></div></div><Button className="mt-3" variant="outline" asChild><Link href={`/accountant/fiscal-queue?companyId=${item.companyId}`}>Enviar para Fila Fiscal</Link></Button></Card>) : <Card className="p-8">Nenhuma empresa no ranking.</Card>}</div>; }
function QueueList({ items, run, pending }: { items: QueueItem[]; run:(id:string,a:string,b?:Record<string,unknown>)=>void; pending:boolean }) {
  const reason = (label:string) => window.prompt(label)?.trim() || "";
  return <div className="space-y-3">{items.length ? items.map((item) => <Card key={item.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex gap-2"><Badge>{item.severity}</Badge><Badge>{item.status}</Badge></div><h3 className="mt-2 font-bold">{item.title}</h3><p className="text-sm text-subtle">{item.origin} · {item.type}</p></div><div className="flex flex-wrap gap-2"><Button disabled={pending} size="sm" onClick={() => run(item.id, item.status === "OPEN" ? "assign" : "start")}>{item.status === "OPEN" ? "Assumir" : "Iniciar análise"}</Button><Button disabled={pending} size="sm" variant="outline" onClick={() => { const r=reason("Informação necessária"); if(r) run(item.id,"request-information",{reason:r}); }}>Solicitar informação</Button><Button disabled={pending} size="sm" variant="outline" onClick={() => run(item.id,"change-priority",{priority:item.priority === "URGENT" ? "NORMAL" : "URGENT"})}>Alterar prioridade</Button><Button disabled={pending} size="sm" variant="outline" onClick={() => { const r=reason("Justificativa da resolução"); if(r) run(item.id,"resolve",{reason:r}); }}>Resolver</Button><Button disabled={pending} size="sm" variant="outline" onClick={() => { const r=reason("Motivo para ignorar"); if(r) run(item.id,"dismiss",{reason:r}); }}>Ignorar</Button>{["RESOLVED","DISMISSED"].includes(item.status) && <Button size="sm" variant="outline" onClick={() => { const r=reason("Motivo da reabertura"); if(r) run(item.id,"reopen",{reason:r}); }}>Reabrir</Button>}</div></div></Card>) : <Card className="p-8">Nenhuma ocorrência para os filtros.</Card>}</div>;
}
