"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  autoFixClient,
  deleteClient,
  listClients,
  validateSavedClient,
} from "@/lib/services/cliente-service";
import type { IntelligentClient } from "@/lib/client-types";
import { cn, maskCnpj, maskCpf } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

function clientName(client: IntelligentClient) {
  return client.razaoSocial || client.nomeFantasia || client.nome || "Cliente sem nome";
}

function clientDocument(client: IntelligentClient) {
  if (client.tipoPessoa === "PJ" && client.cnpj) return maskCnpj(client.cnpj);
  if (client.cpf) return maskCpf(client.cpf);
  return "--";
}

function fiscalStatus(client: IntelligentClient) {
  const situation = String(client.situacaoCadastral || "").toUpperCase();
  const blocked = ["BAIXADA", "SUSPENSA", "NULA", "INAPTA"].some((status) => situation.includes(status));
  if (blocked) return { label: "Bloqueado", tone: "danger" as const, key: "blocked" };
  const missingRequired = client.tipoPessoa === "PJ"
    ? !client.cnpj || !client.razaoSocial || !client.uf || !client.municipio || !client.indicadorIe
    : !client.cpf || !client.nome;
  if (missingRequired) return { label: "Incompleto", tone: "warning" as const, key: "incomplete" };
  const hasWarnings = !client.codigoIbge || !client.email || (client.tipoPessoa === "PJ" && client.contribuinteIcms && !client.inscricaoEstadual);
  if (hasWarnings) return { label: "Com pendências", tone: "warning" as const, key: "attention" };
  return { label: "Pronto", tone: "success" as const, key: "ready" };
}

function pendingCount(client: IntelligentClient) {
  let count = 0;
  if (client.tipoPessoa === "PJ") {
    if (!client.cnpj) count += 1;
    if (!client.razaoSocial) count += 1;
    if (!client.indicadorIe) count += 1;
    if (client.contribuinteIcms && !client.inscricaoEstadual) count += 1;
  } else {
    if (!client.cpf) count += 1;
    if (!client.nome) count += 1;
  }
  if (!client.uf) count += 1;
  if (!client.municipio) count += 1;
  if (!client.codigoIbge) count += 1;
  if (!client.email) count += 1;
  return count;
}

export function ClientsView() {
  const { confirm } = useConfirmDialog();
  const [clients, setClients] = useState<IntelligentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ufFilter, setUfFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ieFilter, setIeFilter] = useState("all");
  const [taxpayerFilter, setTaxpayerFilter] = useState("all");
  const [pendingFilter, setPendingFilter] = useState("all");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchClients = useCallback(async (q?: string) => {
    try {
      if (q) setSearching(true);
      else setLoading(true);
      setError(null);
      const data = await listClients(q);
      setClients(data);
    } catch {
      setError("Não foi possível carregar clientes. Tente novamente.");
      notify({ title: "Erro ao carregar clientes", tone: "error" });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchClients(search.trim() || undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [fetchClients, search]);

  const ufs = useMemo(
    () => Array.from(new Set(clients.map((client) => client.uf).filter(Boolean))).sort() as string[],
    [clients],
  );

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const status = fiscalStatus(client);
      const pendencies = pendingCount(client);
      if (typeFilter !== "all" && client.tipoPessoa !== typeFilter) return false;
      if (ufFilter !== "all" && client.uf !== ufFilter) return false;
      if (statusFilter !== "all" && status.key !== statusFilter) return false;
      if (ieFilter !== "all" && (client.indicadorIe || "missing") !== ieFilter) return false;
      if (taxpayerFilter === "icms" && !client.contribuinteIcms) return false;
      if (taxpayerFilter === "iss" && !client.contribuinteIss) return false;
      if (taxpayerFilter === "none" && (client.contribuinteIcms || client.contribuinteIss)) return false;
      if (pendingFilter === "with" && pendencies === 0) return false;
      if (pendingFilter === "without" && pendencies > 0) return false;
      return true;
    });
  }, [clients, ieFilter, pendingFilter, statusFilter, taxpayerFilter, typeFilter, ufFilter]);

  const metrics = useMemo(() => {
    const total = clients.length;
    const withPending = clients.filter((client) => pendingCount(client) > 0).length;
    const ready = clients.filter((client) => fiscalStatus(client).key === "ready").length;
    const withoutIeOrIm = clients.filter((client) => client.tipoPessoa === "PJ" && (!client.inscricaoEstadual || !client.inscricaoMunicipal)).length;
    return {
      total,
      active: total,
      withPending,
      ready,
      withoutIeOrIm,
    };
  }, [clients]);

  async function handleValidate(client: IntelligentClient) {
    setActionId(client.id);
    try {
      const result = await validateSavedClient(client.id);
      notify({
        title: "Cadastro validado",
        description: `Score ${result.scoreCadastro}% · ${result.pendencias?.length ?? 0} pendência(s).`,
        tone: result.pendencias?.length ? "info" : "success",
      });
      await fetchClients(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Validação indisponível", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  async function handleAutoFix(client: IntelligentClient) {
    setActionId(client.id);
    try {
      const result = await autoFixClient(client.id);
      notify({
        title: result.corrected ? "Correções aplicadas" : "Nenhuma correção segura disponível",
        description: result.corrected ? `${result.corrections.length} ajuste(s) aplicado(s).` : "Revise as pendências manualmente.",
        tone: result.corrected ? "success" : "info",
      });
      await fetchClients(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Correção automática indisponível", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(client: IntelligentClient) {
    const confirmed = await confirm({
      title: "Inativar cliente",
      description: `Confirma remover ${clientName(client)} do cadastro ativo? Esta ação não apaga documentos fiscais já importados.`,
      confirmLabel: "Inativar",
      tone: "danger",
    });
    if (!confirmed) return;
    setActionId(client.id);
    try {
      await deleteClient(client.id);
      notify({ title: "Cliente inativado", tone: "success" });
      await fetchClients(search.trim() || undefined);
    } catch (error) {
      notify({ title: "Erro ao inativar cliente", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setActionId(null);
    }
  }

  const selectClass = "h-10 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink outline-none";

  if (loading && clients.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-white/60" />
        <Card className="h-72 animate-pulse bg-muted/40" />
      </div>
    );
  }

  if (error && clients.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="outline" className="mt-4" onClick={() => fetchClients()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cadastros"
        title="Clientes"
        description="Gerencie clientes e valide dados fiscais antes da emissão."
        icon={ShieldCheck}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchClients(search.trim() || undefined)}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => notify({ title: "Importação em preparação", description: "Use XML fiscal ou cadastro manual por enquanto." })}>
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" onClick={() => notify({ title: "Exportação em preparação", description: "A exportação será conectada aos relatórios fiscais." })}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button asChild variant="lime">
              <Link href="/customers/new"><Plus className="h-4 w-4" /> Novo cliente</Link>
            </Button>
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["Total de clientes", metrics.total],
          ["Clientes ativos", metrics.active],
          ["Com pendências", metrics.withPending],
          ["Prontos para emitir", metrics.ready],
          ["Sem IE/IM", metrics.withoutIeOrIm],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] font-bold uppercase text-subtle">{label}</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_repeat(6,auto)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, razão social, CPF/CNPJ, e-mail, cidade ou UF"
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />}
          </div>
          <select className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Tipo: todos</option>
            <option value="PJ">PJ</option>
            <option value="PF">PF</option>
          </select>
          <select className={selectClass} value={ufFilter} onChange={(event) => setUfFilter(event.target.value)}>
            <option value="all">UF: todas</option>
            {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Status fiscal</option>
            <option value="ready">Prontos</option>
            <option value="attention">Com pendências</option>
            <option value="incomplete">Incompletos</option>
            <option value="blocked">Bloqueados</option>
          </select>
          <select className={selectClass} value={ieFilter} onChange={(event) => setIeFilter(event.target.value)}>
            <option value="all">Indicador IE</option>
            <option value="1">1 - Contribuinte</option>
            <option value="2">2 - Isento</option>
            <option value="9">9 - Não contribuinte</option>
            <option value="missing">Sem indicador</option>
          </select>
          <select className={selectClass} value={taxpayerFilter} onChange={(event) => setTaxpayerFilter(event.target.value)}>
            <option value="all">Contribuinte</option>
            <option value="icms">ICMS</option>
            <option value="iss">ISS</option>
            <option value="none">Não contribuinte</option>
          </select>
          <select className={selectClass} value={pendingFilter} onChange={(event) => setPendingFilter(event.target.value)}>
            <option value="all">Pendências</option>
            <option value="with">Com pendências</option>
            <option value="without">Sem pendências</option>
          </select>
        </div>
      </Card>

      {clients.length === 0 && (
        <Card className="p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-subtle" />
          <h2 className="text-xl font-bold text-ink">Nenhum cliente cadastrado.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
            Cadastre seu primeiro cliente ou busque dados fiscais por CPF/CNPJ para iniciar emissões.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="lime"><Link href="/customers/new">Novo cliente</Link></Button>
            <Button asChild variant="outline"><Link href="/customers/new">Buscar CPF/CNPJ</Link></Button>
          </div>
        </Card>
      )}

      {clients.length > 0 && filteredClients.length === 0 && (
        <Card className="p-10 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-subtle" />
          <h2 className="text-lg font-bold text-ink">Nenhum cliente encontrado.</h2>
          <p className="mt-2 text-sm text-subtle">Ajuste a busca ou os filtros para visualizar outros clientes.</p>
        </Card>
      )}

      {filteredClients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">CPF/CNPJ</th>
                  <th className="px-4 py-3 text-left">Cidade/UF</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Indicador IE</th>
                  <th className="px-4 py-3 text-left">Status fiscal</th>
                  <th className="px-4 py-3 text-center">Pendências</th>
                  <th className="px-4 py-3 text-left">Última atualização</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredClients.map((client) => {
                  const status = fiscalStatus(client);
                  const pendencies = pendingCount(client);
                  const busy = actionId === client.id;
                  return (
                    <tr key={client.id} className="transition hover:bg-muted/30">
                      <td className="px-4 py-3.5">
                        <Link href={`/customers/${client.id}`} className="font-bold text-ink hover:underline">
                          {clientName(client)}
                        </Link>
                        <p className="mt-1 max-w-[240px] truncate text-xs text-subtle">{client.email || "E-mail não informado"}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm text-ink">{clientDocument(client)}</td>
                      <td className="px-4 py-3.5 text-sm text-ink">{client.municipio || "--"} / {client.uf || "--"}</td>
                      <td className="px-4 py-3.5"><Badge variant={client.tipoPessoa === "PJ" ? "dark" : "info"}>{client.tipoPessoa}</Badge></td>
                      <td className="px-4 py-3.5 text-sm">{client.indicadorIe || <span className="text-subtle">--</span>}</td>
                      <td className="px-4 py-3.5"><Badge variant={status.tone}>{status.label}</Badge></td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn("inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-extrabold", pendencies > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                          {pendencies}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-subtle">{new Date(client.updatedAt).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <Button asChild variant="ghost" size="icon" title="Ver detalhes"><Link href={`/customers/${client.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Editar"><Link href={`/customers/${client.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" title="Validar" onClick={() => handleValidate(client)} disabled={busy}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" title="Corrigir pendências" onClick={() => handleAutoFix(client)} disabled={busy}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button asChild variant="ghost" size="icon" title="Ver documentos"><Link href={`/customers/${client.id}/documents`}><FileText className="h-4 w-4" /></Link></Button>
                          <Button asChild variant="ghost" size="icon" title="Emitir nota"><Link href={`/emitir-nota?customerId=${client.id}`}><Zap className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" title="Inativar" onClick={() => handleDelete(client)} disabled={busy}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line bg-muted/30 px-4 py-2.5 text-xs text-subtle">
            {filteredClients.length} cliente(s) exibido(s)
          </div>
        </Card>
      )}
    </div>
  );
}
