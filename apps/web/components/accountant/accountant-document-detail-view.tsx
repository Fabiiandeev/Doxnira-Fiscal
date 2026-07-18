"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAccountantDocumentDetail, getAccountantDocumentXml } from "@/lib/services/accountant-documents-service";
import { DocumentReviewPanel } from "@/components/accountant/document-review-panel";
import { DocumentNotesPanel } from "@/components/accountant/document-notes-panel";
import { DocumentTagsPanel } from "@/components/accountant/document-tags-panel";
import { DocumentRequestsPanel } from "@/components/accountant/document-requests-panel";
import { formatCurrency, formatDate } from "@/lib/utils";

type Detail = { documentType: string; operationDirection: string; identification: Record<string, string | boolean | null>; issuer: Record<string, string | null> | null; recipient: Record<string, string | null> | null; totals: Record<string, string | null>; items: Array<Record<string, string | number | null>>; events: Array<Record<string, string | number | null>>; alerts: Array<Record<string, string | number | null>>; review: { status?: string; user?: { name?: string }; note?: string } | null; xml: { availability: string }; };

export function AccountantDocumentDetailView({ documentId }: { documentId: string }) {
  const params = useSearchParams();
  const companyId = params?.get("companyId") || "";
  const officeId = params?.get("officeId") || "";
  const [copied, setCopied] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const query = useQuery({ queryKey: ["accountant", officeId, companyId, "fiscal-document", documentId], queryFn: () => getAccountantDocumentDetail({ companyId, officeId, documentId }), enabled: Boolean(companyId && officeId) });
  const xmlQuery = useQuery({ queryKey: ["accountant", officeId, companyId, "fiscal-document-xml", documentId], queryFn: () => getAccountantDocumentXml({ companyId, officeId, documentId }), enabled: showXml && Boolean(companyId && officeId) });
  if (query.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  if (query.isError || !query.data) return <Card className="p-8"><p className="font-bold">Documento não está disponível neste contexto.</p><Button className="mt-4" variant="outline" asChild><Link href="/accountant/documents">Voltar à Central</Link></Button></Card>;
  const d = query.data as Detail; const total = (key: string) => d.totals[key] == null ? "Não informado" : formatCurrency(Number(d.totals[key]));
  return <>
    <Link href={`/accountant/documents?companyId=${companyId}&officeId=${officeId}`} className="text-sm font-bold underline">Voltar para documentos</Link>
    <div className="my-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-subtle">{d.documentType} · {d.operationDirection}</p><h1 className="text-3xl font-extrabold">NF-e {String(d.identification.number || "Não informado")}</h1><p className="mt-2 text-sm text-subtle">Série {String(d.identification.series || "Não informado")} · {String(d.identification.status || "")}</p></div><Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(String(d.identification.accessKey || "")); setCopied(true); }}>{copied ? "Chave copiada" : "Copiar chave"}</Button></div>
    {d.identification.isCancelled && <Card className="mb-5 border-red-300 bg-red-50 p-4 font-bold text-red-800">Documento cancelado. Protocolo: {d.identification.protocol || "Não informado"}</Card>}
    <div className="grid gap-4 md:grid-cols-2"><Section title="Identificação" rows={[["Chave", d.identification.accessKey], ["Emissão", d.identification.issueDate ? formatDate(String(d.identification.issueDate)) : null], ["Autorização", d.identification.authorizationDate ? formatDate(String(d.identification.authorizationDate)) : null], ["XML", d.xml.availability], ["Origem", d.identification.origin]]} /><Section title="Emitente" rows={Object.entries(d.issuer || {}).map(([k,v]) => [k, v])} /><Section title="Destinatário" rows={Object.entries(d.recipient || {}).map(([k,v]) => [k, v])} /><Section title="Conferência" rows={[["Status", d.review?.status || "PENDING"], ["Responsável", d.review?.user?.name], ["Observação", d.review?.note]]} /></div>
    <div className="my-5"><DocumentReviewPanel officeId={officeId} companyId={companyId} documentId={documentId} status={d.review?.status} kind="FISCAL" /></div>
    <div className="my-5 grid gap-5 lg:grid-cols-2"><DocumentNotesPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="FISCAL" /><DocumentTagsPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="FISCAL" /></div>
    <Card className="my-5 p-5"><h2 className="font-extrabold">Totais fiscais</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Produtos","products"],["Frete","freight"],["Total","total"],["ICMS","icms"],["IPI","ipi"],["PIS","pis"],["COFINS","cofins"]].map(([label,key]) => <div key={key} className="rounded-xl bg-muted p-3"><p className="text-xs text-subtle">{label}</p><p className="font-bold">{total(key)}</p></div>)}</div></Card>
    <Card className="my-5 overflow-x-auto p-5"><h2 className="mb-4 font-extrabold">Itens</h2>{d.items.length ? <table className="w-full min-w-[760px] text-sm"><thead><tr><th>Nº</th><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Qtd.</th><th>Total</th></tr></thead><tbody>{d.items.map((item) => <tr key={String(item.number)} className="border-t"><td>{item.number}</td><td>{item.code || "—"}</td><td>{item.description || "Não informado"}</td><td>{item.ncm || "—"}</td><td>{item.cfop || "—"}</td><td>{item.quantity || "—"}</td><td>{item.totalValue == null ? "Não informado" : formatCurrency(Number(item.totalValue))}</td></tr>)}</tbody></table> : <p className="text-sm text-subtle">Nenhum item disponível.</p>}</Card>
    <Card className="my-5 p-5"><h2 className="font-extrabold">Eventos e alertas</h2>{[...d.events, ...d.alerts].length ? <ul className="mt-3 space-y-2 text-sm">{d.events.map((e) => <li key={String(e.id)}>{String(e.type || "Evento")} · {e.date ? formatDate(String(e.date)) : "Não informado"}</li>)}{d.alerts.map((a) => <li key={String(a.id)} className="font-bold text-red-700">{String(a.severity)}: {String(a.title)}</li>)}</ul> : <p className="mt-3 text-sm text-subtle">Nenhum evento ou alerta disponível.</p>}</Card>
    <Card className="my-5 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold">XML</h2><p className="text-sm text-subtle">Visualização permitida conforme a concessão do escritório. Download continua protegido separadamente.</p></div><Button variant="outline" disabled={d.xml.availability === "MISSING"} onClick={() => setShowXml((value) => !value)}>{showXml ? "Ocultar XML" : "Visualizar XML"}</Button></div>{showXml && <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-muted p-4 text-xs">{xmlQuery.isLoading ? "Carregando XML…" : xmlQuery.isError ? "XML não disponível para visualização." : xmlQuery.data?.xml}</pre>}</Card>
    <div className="my-5"><DocumentRequestsPanel officeId={officeId} companyId={companyId} documentId={documentId} kind="FISCAL" /></div>
  </>;
}
function Section({ title, rows }: { title: string; rows: Array<[string, unknown]> }) { return <Card className="p-5"><h2 className="font-extrabold">{title}</h2><dl className="mt-3 space-y-2 text-sm">{rows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4"><dt className="text-subtle">{label}</dt><dd className="text-right font-medium">{String(value || "Não informado")}</dd></div>)}</dl></Card>; }
