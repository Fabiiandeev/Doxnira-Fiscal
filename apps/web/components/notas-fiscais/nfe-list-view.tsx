"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileDown,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  initialNfeFilters,
  useCreateNfeDraft,
  useDeleteNfeDraft,
  useNfeFilters,
  useNfeList,
} from "@/lib/hooks/use-nfe-list";
import type { NfeFilters, NfeListItem, NfeListResponse, NfeStatus } from "@/lib/nfe-types";
import {
  applyNfeAutoFix,
  duplicateNfe,
  getNfeStatus,
  transmitNfe,
  validateNfe,
} from "@/lib/services/nfe-service";
import { cn, formatCurrency, formatDate, maskCnpj, maskCpf } from "@/lib/utils";

const pageSize = 10;

const emptyResponse: NfeListResponse = {
  data: [],
  summary: {
    total: 0,
    drafts: 0,
    validating: 0,
    rejected: 0,
    authorized: 0,
    cancelled: 0,
    authorizedValue: 0,
    pending: 0,
  },
  pagination: { page: 1, limit: pageSize, total: 0, totalPages: 1 },
};

const statusMeta: Record<NfeStatus, { label: string; variant: "neutral" | "warning" | "danger" | "success" | "info" | "dark" | "lime" }> = {
  RASCUNHO: { label: "Rascunho", variant: "neutral" },
  EM_VALIDACAO: { label: "Em Validação", variant: "warning" },
  PRONTA_TRANSMISSAO: { label: "Pronta para Transmissão", variant: "lime" },
  TRANSMITINDO: { label: "Transmitindo", variant: "info" },
  PROCESSANDO_SEFAZ: { label: "Processando SEFAZ", variant: "info" },
  AUTORIZADA: { label: "Autorizada", variant: "success" },
  REJEITADA: { label: "Rejeitada", variant: "danger" },
  CANCELADA: { label: "Cancelada", variant: "dark" },
  DENEGADA: { label: "Denegada", variant: "danger" },
  INUTILIZADA: { label: "Inutilizada", variant: "dark" },
};

const lockedStatuses = new Set<NfeStatus>(["AUTORIZADA", "CANCELADA", "DENEGADA", "INUTILIZADA"]);

export function NfeListView({ initialProductId }: { initialProductId?: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("emissionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<NfeListItem | null>(null);
  const { filters, setFilters, activeFilterCount, resetFilters } = useNfeFilters();
  const query = useNfeList({ page, limit: pageSize, filters, sortBy, sortOrder });
  const createDraft = useCreateNfeDraft();
  const deleteDraft = useDeleteNfeDraft();
  const productDraftStartedRef = useRef<string | null>(null);

  const response = query.data ?? emptyResponse;
  const hasFilters = activeFilterCount > 0 || Boolean(filters.search);

  function updateFilters(next: Partial<NfeFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function sort(column: string) {
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }

  function handleCreateDraft() {
    createDraft.mutate(undefined, {
      onSuccess: (result) => {
        if (!result.id) {
          notify({ title: "Rascunho não criado", description: "A API não retornou o identificador da NF-e.", tone: "error" });
          return;
        }
        notify({ title: "Rascunho criado", description: "Abrindo dados da nova NF-e.", tone: "success" });
        router.push(`/emitir-nota?id=${result.id}`);
      },
      onError: (error) => {
        notify({ title: "Não foi possível criar a NF-e", description: (error as Error).message, tone: "error" });
      },
    });
  }

  useEffect(() => {
    if (!initialProductId) return;
    if (productDraftStartedRef.current === initialProductId) return;
    productDraftStartedRef.current = initialProductId;
    notify({
      title: "Preparando NF-e do produto",
      description: "Criando rascunho com o produto selecionado.",
      tone: "info",
    });
    createDraft.mutate(undefined, {
      onSuccess: (result) => {
        if (!result.id) {
          notify({ title: "Rascunho não criado", description: "A API não retornou o identificador da NF-e.", tone: "error" });
          return;
        }
        router.push(`/emitir-nota?id=${result.id}&productId=${encodeURIComponent(initialProductId)}`);
      },
      onError: (error) => {
        notify({ title: "Não foi possível criar a NF-e", description: (error as Error).message, tone: "error" });
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  function exportCsv() {
    if (response.data.length === 0) {
      notify({ title: "Nada para exportar", description: "A lista atual não possui NF-e.", tone: "info" });
      return;
    }
    const rows = response.data.map((note) => [
      note.number || "",
      note.series || "",
      note.customerName || "",
      note.customerDocument || "",
      note.emissionDate || "",
      note.value || "",
      statusMeta[note.status]?.label || note.status,
      environmentLabel(note.environment),
      note.protocol || "",
      note.updatedAt || "",
    ]);
    const csv = [
      ["numero", "serie", "cliente", "documento", "emissao", "valor", "status", "ambiente", "protocolo", "ultima_atualizacao"],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "notas-fiscais-eletronicas.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify({ title: "Exportação gerada", description: `${response.data.length} NF-e exportadas da página atual.` });
  }

  function handleDeleteDraft() {
    if (!deleteTarget) return;
    deleteDraft.mutate(deleteTarget.id, {
      onSuccess: () => {
        notify({ title: "Rascunho excluído", tone: "success" });
        setDeleteTarget(null);
        query.refetch();
      },
      onError: (error) => {
        notify({ title: "Não foi possível excluir", description: (error as Error).message, tone: "error" });
      },
    });
  }

  return (
    <>
      <NfeListHeader
        creating={createDraft.isPending}
        onCreate={handleCreateDraft}
        onExport={exportCsv}
      />

      <NfeSummaryCards data={response} loading={query.isLoading} />

      <Card className="overflow-hidden">
        <NfeFilters
          filters={filters}
          activeFilterCount={activeFilterCount}
          onChange={updateFilters}
          onReset={() => {
            resetFilters();
            setPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <p className="mr-auto text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
            {response.pagination.total} NF-e encontradas
          </p>
          <button
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-subtle"
          >
            <RefreshCw className={cn("h-3 w-3", query.isFetching && "animate-spin")} />
            Atualizar
          </button>
          {hasFilters && (
            <button
              onClick={() => {
                setFilters(initialNfeFilters);
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-white"
            >
              Limpar filtros
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {query.isLoading ? (
          <NfeTableSkeleton />
        ) : query.isError ? (
          <NfeErrorState onRetry={() => query.refetch()} />
        ) : response.data.length === 0 ? (
          <NfeEmptyState filtered={hasFilters} onCreate={handleCreateDraft} onReset={() => setFilters(initialNfeFilters)} />
        ) : (
          <NfeTable
            data={response.data}
            page={page}
            totalPages={response.pagination.totalPages}
            total={response.pagination.total}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={sort}
            onPageChange={setPage}
            onDelete={setDeleteTarget}
            onChanged={() => query.refetch()}
          />
        )}
      </Card>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogTitle>Excluir rascunho?</DialogTitle>
          <DialogDescription>
            Esta ação só é permitida para NF-e em rascunho. A nota será removida da lista operacional.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteDraft} disabled={deleteDraft.isPending}>
              <Trash2 className="h-4 w-4" />
              Excluir rascunho
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NfeListHeader({
  creating,
  onCreate,
  onExport,
}: {
  creating: boolean;
  onCreate: () => void;
  onExport: () => void;
}) {
  return (
    <PageHeader
      eyebrow="NF-e modelo 55"
      title="Notas Fiscais Eletrônicas"
      description="Gerencie, pesquise e acompanhe suas NF-e."
      icon={FileText}
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="lime" onClick={onCreate} disabled={creating}>
            <Plus className="h-4 w-4" />
            Nova NF-e
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/xml-center")}>
            <Upload className="h-4 w-4" />
            Importar XML
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <details className="relative"><summary title="Mais ações" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-line bg-white"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-line bg-white p-2 shadow-xl"><button className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-muted" onClick={() => window.location.assign("/sync")}>Sincronizar SEFAZ</button></div></details>
        </div>
      }
    />
  );
}

function NfeSummaryCards({ data, loading }: { data: NfeListResponse; loading: boolean }) {
  const cards = [
    { label: "Total de NF-e", value: data.summary.total, icon: FileText },
    { label: "Rascunhos", value: data.summary.drafts, icon: Edit },
    { label: "Em Validação", value: data.summary.validating, icon: ShieldCheck },
    { label: "Rejeitadas", value: data.summary.rejected, icon: AlertTriangle },
    { label: "Autorizadas", value: data.summary.authorized, icon: CheckCircle2 },
    { label: "Valor Total Autorizado", value: formatCurrency(Number(data.summary.authorizedValue || 0)), icon: FileDown },
  ];

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="p-4">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-7 w-20 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-subtle">{card.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-ink">{card.value}</p>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted">
                  <Icon className="h-5 w-5 text-ink" />
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function NfeFilters({
  filters,
  activeFilterCount,
  onChange,
  onReset,
}: {
  filters: NfeFilters;
  activeFilterCount: number;
  onChange: (filters: Partial<NfeFilters>) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-line p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            className="h-12 rounded-2xl bg-muted/70 pl-11"
            placeholder="Buscar por número, série, chave, cliente, CNPJ/CPF, protocolo ou natureza..."
          />
        </div>
        <Button variant="outline" onClick={() => setExpanded((current) => !current)}>
          <Filter className="h-4 w-4" />
          Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      {expanded && <div className="grid gap-3 border-t border-line pt-4 md:grid-cols-2 xl:grid-cols-5">
        <FilterField label="Período inicial">
          <input className={filterInputClass} type="date" value={filters.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
        </FilterField>
        <FilterField label="Período final">
          <input className={filterInputClass} type="date" value={filters.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
        </FilterField>
        <FilterField label="Status">
          <select className={filterInputClass} value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
            <option value="">Todos</option>
            {Object.entries(statusMeta).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Ambiente">
          <select className={filterInputClass} value={filters.environment} onChange={(event) => onChange({ environment: event.target.value })}>
            <option value="">Todos</option>
            <option value="1">Produção</option>
            <option value="2">Homologação</option>
          </select>
        </FilterField>
        <FilterField label="Cliente">
          <input className={filterInputClass} value={filters.customer} onChange={(event) => onChange({ customer: event.target.value })} placeholder="Nome ou CNPJ/CPF" />
        </FilterField>
        <FilterField label="Número">
          <input className={filterInputClass} value={filters.number} onChange={(event) => onChange({ number: event.target.value })} placeholder="000123456" />
        </FilterField>
        <FilterField label="Série">
          <input className={filterInputClass} value={filters.series} onChange={(event) => onChange({ series: event.target.value })} placeholder="1" />
        </FilterField>
        <FilterField label="Chave de acesso">
          <input className={filterInputClass} value={filters.accessKey} onChange={(event) => onChange({ accessKey: event.target.value })} placeholder="44 dígitos" />
        </FilterField>
        <FilterField label="Valor mínimo">
          <input className={filterInputClass} value={filters.minValue} onChange={(event) => onChange({ minValue: event.target.value })} placeholder="R$ 0,00" />
        </FilterField>
        <FilterField label="Valor máximo">
          <input className={filterInputClass} value={filters.maxValue} onChange={(event) => onChange({ maxValue: event.target.value })} placeholder="R$ 0,00" />
        </FilterField>
        <FilterField label="UF">
          <input className={filterInputClass} value={filters.uf} onChange={(event) => onChange({ uf: event.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" />
        </FilterField>
        <FilterField label="Tipo de operação">
          <select className={filterInputClass} value={filters.operationType} onChange={(event) => onChange({ operationType: event.target.value })}>
            <option value="">Todos</option>
            <option value="1">1 - Saída</option>
            <option value="0">0 - Entrada</option>
          </select>
        </FilterField>
        <div className="flex items-end gap-2 xl:col-span-5 xl:justify-end">
          <Button variant="outline" onClick={onReset}>Limpar filtros</Button>
          <Button variant="lime" onClick={() => setExpanded(false)}><Search className="h-4 w-4" />Buscar</Button>
        </div>
      </div>}
    </div>
  );
}

const filterInputClass = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ink/10";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-subtle">{label}</span>
      {children}
    </label>
  );
}

function NfeTable({
  data,
  page,
  totalPages,
  total,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onDelete,
  onChanged,
}: {
  data: NfeListItem[];
  page: number;
  totalPages: number;
  total: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  onDelete: (note: NfeListItem) => void;
  onChanged: () => void;
}) {
  const headers = [
    ["number", "Número / Série"],
    ["customer", "Cliente"],
    ["emissionDate", "Emissão"],
    ["value", "Valor"],
    ["status", "Status"],
    ["environment", "Ambiente"],
    ["protocol", "Protocolo"],
    ["updatedAt", "Última atualização"],
  ];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left">
          <thead className="bg-muted/50">
            <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-subtle">
              {headers.map(([column, label]) => (
                <th key={column} className="px-4 py-3">
                  <button className="inline-flex items-center gap-1" onClick={() => onSort(column)}>
                    {label}
                    {sortBy === column && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((note) => (
              <tr key={note.id} className="bg-white transition hover:bg-muted/30">
                <td className="px-4 py-3"><p className="font-mono text-sm font-bold">{note.number ? String(note.number).padStart(9, "0") : "—"} / {note.series || "—"}</p><p className="mt-1 text-[10px] text-subtle">Modelo 55</p></td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-sm font-bold text-ink">{note.customerName || "Destinatário não informado"}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">{formatDocument(note.customerDocument)}</p>
                </td>
                <td className="px-4 py-3 text-sm">{note.emissionDate ? formatDate(note.emissionDate, true) : "—"}</td>
                <td className="px-4 py-3 text-sm font-bold">{formatCurrency(Number(note.value || 0))}</td>
                <td className="px-4 py-3"><NfeStatusBadge status={note.status} /></td>
                <td className="px-4 py-3 text-sm">{environmentLabel(note.environment)}</td>
                <td className="px-4 py-3 font-mono text-xs">{note.protocol || "—"}</td>
                <td className="px-4 py-3 text-sm">{formatDate(note.updatedAt, true)}</td>
                <td className="px-4 py-3">
                  <NfeRowActions note={note} onDelete={onDelete} onChanged={onChanged} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-subtle">
          Página {page} de {totalPages} · {total} registros
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Próxima</Button>
        </div>
      </div>
    </>
  );
}

function NfeStatusBadge({ status }: { status: NfeStatus }) {
  const meta = statusMeta[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function NfeRowActions({
  note,
  onDelete,
  onChanged,
}: {
  note: NfeListItem;
  onDelete: (note: NfeListItem) => void;
  onChanged: () => void;
}) {
  const router = useRouter();

  async function runAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      notify({ title: "Ação não concluída", description: (error as Error).message, tone: "error" });
    }
  }

  const canEdit = note.status === "RASCUNHO" || note.status === "EM_VALIDACAO" || note.status === "REJEITADA";
  const canOpenDanfe = note.status === "AUTORIZADA";

  return (
    <div className="flex items-center justify-center gap-1">
      <ActionIcon title="Abrir detalhes" icon={Eye} onClick={() => router.push(`/emitir-nota?id=${note.id}`)} />
      <ActionIcon
        title="Editar rascunho"
        icon={Edit}
        onClick={() => {
          if (!canEdit) {
            notify({ title: "Edição bloqueada", description: "NF-e autorizada, cancelada, denegada ou inutilizada não pode ser editada.", tone: "info" });
            return;
          }
          router.push(`/emitir-nota?id=${note.id}`);
        }}
      />
      <ActionIcon title="Duplicar nota" icon={Copy} onClick={() => runAction(async () => {
        const result = await duplicateNfe(note.id);
        notify({ title: "NF-e duplicada", description: "Novo rascunho criado com base na nota selecionada.", tone: "success" });
        if (result.id) router.push(`/emitir-nota?id=${result.id}`);
      })} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button title="Mais ações" className="grid h-8 w-8 place-items-center rounded-lg text-ink transition hover:bg-muted"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Mais ações</span></button></DropdownMenuTrigger>
        <DropdownMenuContent avoidCollisions sticky="always" className="grid gap-1 [&_button]:!flex [&_button]:!w-full [&_button]:!justify-start [&_button]:!gap-2 [&_button]:!px-3 [&_button]:after:text-xs [&_button]:after:font-semibold [&_button]:after:content-[attr(title)]">
      <ActionIcon
        title="Continuar emissão"
        icon={FileText}
        onClick={() => {
          if (lockedStatuses.has(note.status)) {
            notify({ title: "Emissão encerrada", description: "Esta NF-e não permite continuação de emissão neste status.", tone: "info" });
            return;
          }
          router.push(`/emitir-nota?id=${note.id}`);
        }}
      />
      <ActionIcon
        title="Validar"
        icon={ShieldCheck}
        onClick={() => runAction(async () => {
          const result = await validateNfe(note.id);
          notify({ title: result.canTransmit ? "NF-e pronta" : "Pendências encontradas", description: result.message, tone: result.canTransmit ? "success" : "info" });
          onChanged();
        })}
      />
      <ActionIcon
        title="Corrigir automaticamente"
        icon={RefreshCw}
        onClick={() => runAction(async () => {
          const fixResult = await applyNfeAutoFix(note.id);
          const fixMessage = fixResult.corrections.length > 0
            ? `${fixResult.corrections.length} correção(ões) aplicada(s).`
            : fixResult.message || "Nenhuma correção segura disponível.";
          const validation = await validateNfe(note.id);
          notify({
            title: validation.canTransmit ? "NF-e revisada" : "NF-e revisada com pendências",
            description: `${fixMessage} ${validation.message || ""}`.trim(),
            tone: validation.canTransmit ? "success" : "info",
          });
          onChanged();
        })}
      />
      <ActionIcon
        title="Transmitir"
        icon={Send}
        onClick={() => runAction(async () => {
          const validation = await validateNfe(note.id);
          if (!validation.canTransmit) {
            notify({
              title: "NF-e com pendências",
              description: validation.message || "Corrija os pontos críticos antes de transmitir.",
              tone: "info",
            });
            onChanged();
            return;
          }
          const result = await transmitNfe(note.id);
          notify({ title: "Transmissão iniciada", description: result.message, tone: "success" });
          onChanged();
        })}
      />
      <ActionIcon
        title="Consultar SEFAZ"
        icon={Search}
        onClick={() => runAction(async () => {
          const status = await getNfeStatus(note.id);
          notify({ title: "Status consultado", description: `${statusMeta[status.status as NfeStatus]?.label || status.status}: ${status.message || "sem mensagem"}` });
        })}
      />
      <ActionIcon
        title="Visualizar retorno"
        icon={Clock}
        onClick={() => {
          if (!["TRANSMITINDO", "PROCESSANDO_SEFAZ", "AUTORIZADA", "REJEITADA"].includes(note.status)) {
            notify({ title: "Retorno indisponível", description: "A NF-e ainda não foi transmitida para a SEFAZ.", tone: "info" });
            return;
          }
          router.push(`/emitir-nota?id=${note.id}`);
        }}
      />
      <ActionIcon
        title="Visualizar DANFE"
        icon={FileDown}
        onClick={() => {
          if (!canOpenDanfe) {
            notify({ title: "DANFE indisponível", description: "O DANFE só é gerado após autorização da NF-e.", tone: "info" });
            return;
          }
          router.push(`/emitir-nota?id=${note.id}&view=danfe`);
        }}
      />
      <ActionIcon
        title="Baixar XML"
        icon={Download}
        onClick={() => notify({ title: "Download XML", description: canOpenDanfe ? "Arquivo XML será baixado quando o storage estiver conectado." : "XML autorizado ainda não foi gerado.", tone: canOpenDanfe ? "success" : "info" })}
      />
      <ActionIcon
        title="Baixar DANFE"
        icon={FileDown}
        onClick={() => notify({ title: "Download DANFE", description: canOpenDanfe ? "DANFE será baixado quando o gerador PDF estiver conectado." : "DANFE disponível somente para NF-e autorizada.", tone: canOpenDanfe ? "success" : "info" })}
      />
      <DropdownMenuSeparator className="my-1 h-px bg-line" />
      <ActionIcon
        title="Cancelar NF-e"
        icon={XCircle}
        onClick={() => {
          if (note.status !== "AUTORIZADA") {
            notify({ title: "Cancelamento bloqueado", description: "Somente NF-e autorizada pode ser cancelada.", tone: "info" });
            return;
          }
          notify({ title: "Cancelamento NF-e", description: "Solicitação de cancelamento será enviada quando o evento SEFAZ estiver configurado.", tone: "info" });
        }}
      />
      <ActionIcon
        title="Excluir rascunho"
        icon={Trash2}
        danger
        onClick={() => {
          if (note.status !== "RASCUNHO") {
            notify({ title: "Exclusão bloqueada", description: "Somente rascunhos podem ser excluídos.", tone: "info" });
            return;
          }
          onDelete(note);
        }}
      />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ActionIcon({
  title,
  icon: Icon,
  onClick,
  danger,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg text-ink transition hover:bg-muted",
        danger && "text-red-500 hover:bg-red-50",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{title}</span>
    </button>
  );
}

function NfeTableSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/70" />
      ))}
    </div>
  );
}

function NfeErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-10 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
      <h2 className="mt-4 text-xl font-extrabold text-ink">Não foi possível carregar as NF-e</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-subtle">Verifique a conexão com a API e tente novamente.</p>
      <Button className="mt-5" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

function NfeEmptyState({
  filtered,
  onCreate,
  onReset,
}: {
  filtered: boolean;
  onCreate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="p-12 text-center">
      <FileText className="mx-auto h-12 w-12 text-subtle" />
      <h2 className="mt-4 text-xl font-extrabold text-ink">
        {filtered ? "Nenhuma NF-e encontrada" : "Nenhuma NF-e cadastrada"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
        {filtered
          ? "Ajuste os filtros para localizar a nota fiscal eletrônica desejada."
          : "Crie um rascunho para iniciar a emissão de uma NF-e modelo 55."}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {filtered && <Button variant="outline" onClick={onReset}>Limpar filtros</Button>}
        <Button variant="lime" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Nova NF-e
        </Button>
      </div>
    </div>
  );
}

function environmentLabel(value: string | null) {
  if (value === "1" || value === "production") return "Produção";
  if (value === "2" || value === "homologation") return "Homologação";
  return "—";
}

function formatDocument(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) return maskCnpj(digits);
  if (digits.length === 11) return maskCpf(digits);
  return value;
}
