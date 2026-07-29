"use client";

import { useState } from "react";
import { CheckCircle2, FlaskConical, Pencil, Plus, Power, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { useFiscalRules, useRuleMutation } from "@/lib/services/fiscal/fiscal-ai-hooks";
import { fiscalRulesService, type FiscalRule } from "@/lib/services/fiscal/fiscal-rules-service";

const empty = { taxRegime: "SIMPLES_NACIONAL", taxType: "ICMS", rate: "0", uf: "", cfop: "", ncm: "", effectiveFrom: new Date().toISOString().slice(0, 10) };

export function FiscalRulesView() {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FiscalRule | null>(null); const [form, setForm] = useState(empty);
  const query = useFiscalRules(search, page); const mutation = useRuleMutation();
  const save = async () => {
    const data = { ...form, rate: Number(form.rate), uf: form.uf || null, cfop: form.cfop || null, ncm: form.ncm || null, effectiveFrom: new Date(form.effectiveFrom).toISOString(), creditAllowed: false, debitAllowed: false };
    try { await mutation.mutateAsync({ op: editing ? "update" : "create", id: editing?.id, data }); setEditing(null); setForm(empty); notify({ title: "Regra salva", tone: "success" }); } catch (e) { notify({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Falha", tone: "error" }); }
  };
  const edit = (r: FiscalRule) => { setEditing(r); setForm({ taxRegime: r.taxRegime, taxType: r.taxType, rate: String(r.rate), uf: r.uf || "", cfop: r.cfop || "", ncm: r.ncm || "", effectiveFrom: r.effectiveFrom.slice(0, 10) }); };
  const op = async (name: "toggle" | "version", id: string) => { try { await mutation.mutateAsync({ op: name, id }); notify({ title: name === "toggle" ? "Status atualizado" : "Nova versão criada", tone: "success" }); } catch (e) { notify({ title: "Falha", description: e instanceof Error ? e.message : "Erro", tone: "error" }); } };
  const test = async (r: FiscalRule) => { const result = await fiscalRulesService.test(r.id, { cfop: r.cfop || undefined, ncm: r.ncm || undefined }); notify({ title: result.matched ? "Regra compatível" : "Regra não aplicável", description: `Alíquota: ${result.rate}%` }); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Regras Fiscais</h1><p className="text-sm text-subtle">Regras reais, versionadas e isoladas por empresa.</p></div><Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
    <Card className="p-4"><div className="grid gap-3 md:grid-cols-4"><Input placeholder="Regime" value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}/><Input placeholder="Tributo" value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })}/><Input type="number" placeholder="Alíquota" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })}/><Input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}/><Input placeholder="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })}/><Input placeholder="CFOP" value={form.cfop} onChange={(e) => setForm({ ...form, cfop: e.target.value })}/><Input placeholder="NCM" value={form.ncm} onChange={(e) => setForm({ ...form, ncm: e.target.value })}/><Button variant="lime" onClick={save} disabled={mutation.isPending}><Plus className="h-4 w-4"/>{editing ? "Salvar edição" : "Criar regra"}</Button></div></Card>
    <Card className="p-4"><Input placeholder="Pesquisar por tributo, CFOP ou NCM..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></Card>
    {query.isLoading ? <Card className="h-64 animate-pulse bg-muted"/> : query.error ? <Card className="p-8 text-center"><p>{query.error.message}</p><Button className="mt-3" onClick={() => query.refetch()}>Tentar novamente</Button></Card> :
    <Card className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Tributo","Regime","UF","CFOP","NCM","Alíquota","Status","Ações"].map((h)=><th className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{query.data?.data.length ? query.data.data.map((r)=><tr className="border-t" key={r.id}><td className="p-3 font-bold">{r.taxType}</td><td className="p-3">{r.taxRegime}</td><td className="p-3">{r.uf || "Todas"}</td><td className="p-3">{r.cfop || "Todos"}</td><td className="p-3">{r.ncm || "Todos"}</td><td className="p-3">{r.rate}%</td><td className="p-3"><Badge variant={r.effectiveUntil ? "outline" : "success"}>{r.effectiveUntil ? "Inativa" : "Ativa"}</Badge></td><td className="p-3"><div className="flex gap-1"><Button title="Editar" size="icon" variant="ghost" onClick={()=>edit(r)}><Pencil className="h-4 w-4"/></Button><Button title="Ativar/desativar" size="icon" variant="ghost" onClick={()=>op("toggle",r.id)}><Power className="h-4 w-4"/></Button><Button title="Versionar" size="icon" variant="ghost" onClick={()=>op("version",r.id)}><CheckCircle2 className="h-4 w-4"/></Button><Button title="Testar impacto" size="icon" variant="ghost" onClick={()=>test(r)}><FlaskConical className="h-4 w-4"/></Button></div></td></tr>) : <tr><td colSpan={8} className="p-8 text-center text-subtle">Nenhuma regra fiscal cadastrada.</td></tr>}</tbody></table><div className="flex justify-end gap-2 border-t p-3"><Button variant="outline" disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</Button><span className="p-2 text-xs">Página {page}</span><Button variant="outline" disabled={(query.data?.data.length || 0)<20} onClick={()=>setPage(page+1)}>Próxima</Button></div></Card>}
  </div>;
}
