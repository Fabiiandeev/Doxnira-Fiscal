"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAccountantDocuments, getAccountantDocumentsSummary, listAccountantCompanies, listAccountantTags, type AccountantCompany } from "@/lib/services/accountant-documents-service";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

const tabs = [
  ["Todos", {}], ["Entradas", { operationDirection: "INBOUND" }], ["Saídas", { operationDirection: "OUTBOUND" }],
  ["Cancelados", { cancelled: "true" }], ["Com pendências", { reviewStatus: "WITH_ISSUES" }], ["Não conferidos", { reviewStatus: "PENDING" }],
] as const;

export function AccountantDocumentsView() {
  const [selected, setSelected] = useState<AccountantCompany | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [tagId, setTagId] = useState("");
  const companies = useQuery({ queryKey: ["accountant", "companies"], queryFn: listAccountantCompanies });
  const context = selected ?? companies.data?.data[0] ?? null;
  const filters = useMemo(() => ({ ...tabs[tabIndex][1], query, ...(tagId ? { tagId } : {}) }), [query, tabIndex, tagId]);
  const tags = useQuery({ queryKey: ["accountant", context?.office.id, "tags"], queryFn: () => listAccountantTags({ companyId: context!.company.id, officeId: context!.office.id }), enabled: Boolean(context) });
  const documents = useQuery({
    queryKey: ["accountant", context?.office.id, context?.company.id, "fiscal-documents", filters, page],
    queryFn: () => getAccountantDocuments({ companyId: context!.company.id, officeId: context!.office.id, page, filters }),
    enabled: Boolean(context), placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["accountant", context?.office.id, context?.company.id, "fiscal-documents", "summary"],
    queryFn: () => getAccountantDocumentsSummary({ companyId: context!.company.id, officeId: context!.office.id }),
    enabled: Boolean(context),
  });
  const rows = documents.data?.data ?? [];

  return <>
    <PageHeader eyebrow="Contabilidade" title="Documentos Fiscais" description="Consulta, conferência e auditoria da empresa cliente selecionada." />
    {!context ? <Card className="p-8 text-sm text-subtle">Nenhuma empresa cliente está liberada para o seu usuário contábil.</Card> : <>
      <Card className="mb-5 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <label className="text-xs font-bold">Empresa cliente</label>
        <select className="h-10 rounded-xl border border-line bg-white px-3 text-sm" value={`${context.office.id}:${context.company.id}`} onChange={(event) => {
          const next = companies.data?.data.find((item) => `${item.office.id}:${item.company.id}` === event.target.value) ?? null;
          setSelected(next); setPage(1);
        }}>
          {companies.data?.data.map((item) => <option key={`${item.office.id}:${item.company.id}`} value={`${item.office.id}:${item.company.id}`}>{item.company.tradeName || item.company.legalName} · {item.office.name}</option>)}
        </select>
        <span className="text-xs text-subtle">{maskCnpj(context.company.cnpj)} · acesso {context.accessLevel}</span>
      </Card>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Documentos", summary.data?.totalDocuments], ["Entradas", summary.data?.inboundDocuments], ["Saídas", summary.data?.outboundDocuments], ["Não conferidos", summary.data?.unreviewedDocuments]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-[10px] font-bold uppercase text-subtle">{label}</p><p className="mt-2 text-2xl font-extrabold">{summary.isLoading ? "—" : String(value ?? 0)}</p></Card>)}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row"><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Chave, emitente, CNPJ ou número" /><select className="h-10 rounded-xl border border-line bg-white px-3 text-sm" value={tagId} onChange={(event)=>{setTagId(event.target.value);setPage(1);}}><option value="">Todas as etiquetas</option>{tags.data?.map(tag=><option key={String(tag.id)} value={String(tag.id)}>{String(tag.name)}</option>)}</select><Button variant="outline" asChild><Link href={`/accountant/documents?companyId=${context.company.id}`}>Atualizar</Link></Button></div>
        <div className="flex gap-2 overflow-x-auto border-b border-line p-3">{tabs.map(([label], index) => <Button key={label} size="sm" variant={tabIndex === index ? "default" : "outline"} onClick={() => { setTabIndex(index); setPage(1); }}>{label}</Button>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted text-[10px] uppercase text-subtle"><tr><th className="p-3">Tipo</th><th>Documento</th><th>Emitente</th><th>Destinatário</th><th>Emissão</th><th>Valor</th><th>Status</th><th>Etiquetas</th><th>Conferência</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)} className="border-t border-line"><td className="p-3">{String(row.documentType || "NF-e")}</td><td><Link className="font-bold underline" href={`/accountant/documents/${String(row.id)}?companyId=${context.company.id}&officeId=${context.office.id}`}>{String(row.invoiceNumber || "—")}</Link><p className="text-[10px] text-subtle">{String(row.series || "")}</p></td><td>{String(row.issuerName || "—")}</td><td>{String(row.recipientName || "—")}</td><td>{row.emissionDate ? formatDate(String(row.emissionDate)) : "—"}</td><td>{formatCurrency(Number(row.totalAmount || 0))}</td><td><Badge>{String(row.status || "—")}</Badge></td><td className="max-w-40">{(row.tags as Array<{id:string;name:string}> | undefined)?.slice(0,2).map(tag=><Badge key={tag.id}>{tag.name}</Badge>)}</td><td><Badge>{String((row.review as { status?: string } | undefined)?.status || "PENDING")}</Badge></td></tr>)}</tbody></table></div>
        {!documents.isFetching && rows.length === 0 && <p className="p-8 text-center text-sm text-subtle">Nenhum documento encontrado para os filtros selecionados.</p>}
        <div className="flex items-center justify-between border-t border-line p-4 text-xs"><span>{documents.data?.pagination.total ?? 0} documentos</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={page >= (documents.data?.pagination.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div>
      </Card>
    </>}
  </>;
}
