"use client";

import { Copy, Eye, FileDown, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { usePermissionsContext } from "@/components/providers/permissions-provider";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Mdfe, MdfeListResponse } from "@/lib/mdfe-types";
import { mdfeService } from "@/lib/services/mdfe-service";
import { MdfeStatusBadge } from "./mdfe-status-badge";

const empty: MdfeListResponse = {
  data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, summary: {},
};

export function MdfeListView({ onlyOpen = false }: { onlyOpen?: boolean }) {
  const { hasPermission } = usePermissionsContext();
  const [response, setResponse] = useState(empty);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    try {
      const result = onlyOpen
        ? await mdfeService.open(false).then((data) => ({ ...empty, data: (data.local ?? []) as Mdfe[] }))
        : await mdfeService.list(query.toString());
      setResponse(result);
    } catch (error) {
      notify({ title: "Manifestos não carregados", description: (error as Error).message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [onlyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function duplicate(item: Mdfe) {
    try {
      const copy = await mdfeService.duplicate(item.id);
      notify({ title: "MDF-e duplicado", description: `Novo rascunho ${copy.number}.`, tone: "success" });
      await load();
    } catch (error) {
      notify({ title: "Não foi possível duplicar", description: (error as Error).message, tone: "error" });
    }
  }

  async function remove(item: Mdfe) {
    if (!window.confirm(`Excluir o rascunho MDF-e ${item.number}?`)) return;
    try {
      await mdfeService.remove(item.id);
      notify({ title: "Rascunho excluído", tone: "success" });
      await load();
    } catch (error) {
      notify({ title: "Não foi possível excluir", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documento de transporte · Modelo 58"
        title={onlyOpen ? "MDF-e não encerrados" : "Manifestos eletrônicos"}
        description={onlyOpen ? "Documentos autorizados ou em trânsito que ainda exigem encerramento." : "Emissão, acompanhamento e eventos MDF-e com segregação por empresa."}
        action={hasPermission("fiscal.mdfe.create") ? <Button asChild variant="lime"><Link href="/mdfe/novo"><Plus className="h-4 w-4" /> Novo MDF-e</Link></Button> : undefined}
      />
      {!onlyOpen && (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {["DRAFT", "READY_TO_AUTHORIZE", "AUTHORIZED", "REJECTED", "CLOSED"].map((key) => (
            <Card key={key} className="p-4"><p className="text-xs font-bold text-subtle">{key.replaceAll("_", " ")}</p><p className="mt-1 text-2xl font-extrabold">{response.summary[key] ?? 0}</p></Card>
          ))}
        </div>
      )}
      <Card className="p-4">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={(event) => { event.preventDefault(); void load(); }}>
          <div className="min-w-0 flex-1"><Input label="Buscar por número, chave, placa, motorista ou município" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {!onlyOpen && <label className="text-sm font-bold">Status
            <select className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 md:w-52" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option><option value="DRAFT">Rascunho</option><option value="READY_TO_AUTHORIZE">Pronto</option><option value="AUTHORIZED">Autorizado</option><option value="CLOSED">Encerrado</option><option value="REJECTED">Rejeitado</option>
            </select>
          </label>}
          <Button type="submit" className="self-end"><Search className="h-4 w-4" /> Buscar</Button>
          <Button type="button" variant="outline" className="self-end" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-line bg-muted/60 text-xs uppercase text-subtle"><tr>
              <th className="p-4">Número/série</th><th className="p-4">Emissão</th><th className="p-4">Percurso</th><th className="p-4">Veículo</th><th className="p-4">Documentos</th><th className="p-4">Ambiente</th><th className="p-4">Status</th><th className="p-4">Ações</th>
            </tr></thead>
            <tbody>
              {response.data.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="p-4 font-extrabold">{item.number ?? "—"}/{item.series ?? "1"}</td>
                  <td className="p-4">{new Date(item.emissionDate).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4">{item.loadingState || "—"} → {item.unloadingState || "—"}</td>
                  <td className="p-4">{item.vehicle?.plate || "—"}</td>
                  <td className="p-4">{(item._count as { fiscalDocuments?: number } | undefined)?.fiscalDocuments ?? item.fiscalDocuments?.length ?? 0}</td>
                  <td className="p-4">{item.environment === "production" ? "Produção" : "Homologação"}</td>
                  <td className="p-4"><MdfeStatusBadge status={item.status} /></td>
                  <td className="p-4"><div className="flex gap-1">
                    <Button asChild size="sm" variant="ghost" title="Abrir"><Link href={`/mdfe/${item.id}`}><Eye className="h-4 w-4" /></Link></Button>
                    {hasPermission("fiscal.mdfe.update") && ["DRAFT", "VALIDATION_FAILED"].includes(item.status) && <Button asChild size="sm" variant="ghost" title="Editar"><Link href={`/mdfe/${item.id}/editar`}><Pencil className="h-4 w-4" /></Link></Button>}
                    {hasPermission("fiscal.mdfe.create") && <Button size="sm" variant="ghost" title="Duplicar" onClick={() => void duplicate(item)}><Copy className="h-4 w-4" /></Button>}
                    {hasPermission("fiscal.mdfe.update") && item.status === "DRAFT" && <Button size="sm" variant="ghost" title="Excluir" onClick={() => void remove(item)}><Trash2 className="h-4 w-4" /></Button>}
                    {hasPermission("fiscal.mdfe.download_damdfe") && ["AUTHORIZED", "IN_TRANSIT", "CLOSED", "CANCELLED"].includes(item.status) && <Button asChild size="sm" variant="ghost" title="DAMDFE"><a href={mdfeService.damdfeUrl(item.id)} target="_blank" rel="noreferrer"><FileDown className="h-4 w-4" /></a></Button>}
                  </div></td>
                </tr>
              ))}
              {!loading && response.data.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-subtle">Nenhum MDF-e encontrado.</td></tr>}
              {loading && <tr><td colSpan={8} className="p-10 text-center text-subtle">Carregando manifestos…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
