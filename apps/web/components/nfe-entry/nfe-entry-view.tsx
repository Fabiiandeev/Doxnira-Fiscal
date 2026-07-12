"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileText,
  History,
  Link2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  Printer,
  Truck,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NfeEntry, NfeEntryFilters } from "@/lib/nfe-entry-types";
import type { Product } from "@/lib/product-types";
import {
  autoLinkNfeEntryProducts,
  confirmNfeEntry,
  generateNfeEntryPayables,
  getNfeEntry,
  getNfeEntryDanfe,
  getNfeEntryXml,
  ignoreNfeEntry,
  importNfeEntryXml,
  linkNfeEntryProducts,
  listNfeEntries,
  manifestNfeEntry,
  postNfeEntryInventory,
  prepareNfeEntryBookkeeping,
  prepareNfeEntryInventory,
  syncNfeEntries,
  validateNfeEntry,
} from "@/lib/services/nfe-entry-service";
import type { NfeEntryDanfeArtifact } from "@/lib/services/nfe-entry-service";
import { getCteXml } from "@/lib/services/cte-service";
import { searchNfeProducts } from "@/lib/services/nfe-service";
import { cn, maskCnpj } from "@/lib/utils";

const initialFilters: NfeEntryFilters = {
  q: "",
  startDate: "",
  endDate: "",
  supplier: "",
  accessKey: "",
  number: "",
  series: "",
  status: "",
  manifestation: "",
  stock: "",
  minAmount: "",
  maxAmount: "",
};

const statusLabels: Record<string, string> = {
  SINCRONIZADA: "Sincronizada",
  XML_IMPORTADO: "XML importado",
  PENDENTE_MANIFESTACAO: "Pendente manifestacao",
  MANIFESTADA_CIENCIA: "Ciencia",
  MANIFESTADA_CONFIRMACAO: "Confirmada",
  MANIFESTADA_DESCONHECIMENTO: "Desconhecida",
  MANIFESTADA_NAO_REALIZADA: "Nao realizada",
  PENDENTE_VALIDACAO: "Pendente validacao",
  PENDENTE_VINCULO_PRODUTOS: "Vincular produtos",
  PENDENTE_ESTOQUE: "Pendente estoque",
  PENDENTE_FINANCEIRO: "Pendente financeiro",
  ENTRADA_CONFIRMADA: "Entrada confirmada",
  CANCELADA: "Cancelada",
  IGNORADA: "Ignorada",
  COM_DIVERGENCIA: "Com divergencia",
  ESTOQUE_LANCADO: "Estoque lancado",
  PENDING_REVIEW: "Aguardando revisão",
  READY_TO_POST: "Pronta para lançar",
  POSTED: "Estoque lançado",
  POSTED_WITH_WARNINGS: "Lançada com alertas",
  BLOCKED: "Estoque bloqueado",
  FINANCEIRO_GERADO: "Financeiro gerado",
  SEM_CTE: "Sem CT-e",
  CTE_VINCULADO: "CT-e vinculado",
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusTone(status: string) {
  if (["ENTRADA_CONFIRMADA", "MANIFESTADA_CONFIRMACAO", "ESTOQUE_LANCADO", "POSTED", "POSTED_WITH_WARNINGS", "FINANCEIRO_GERADO", "CTE_VINCULADO"].includes(status)) return "ok";
  if (["CANCELADA", "IGNORADA", "COM_DIVERGENCIA", "BLOCKED", "MANIFESTADA_DESCONHECIMENTO", "MANIFESTADA_NAO_REALIZADA"].includes(status)) return "danger";
  if (status?.startsWith("PENDENTE")) return "warn";
  return "muted";
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  const status = value || "-";
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex min-w-24 justify-center rounded-full px-2.5 py-1 text-[10px] font-extrabold",
        tone === "ok" && "bg-emerald-100 text-emerald-700",
        tone === "warn" && "bg-amber-100 text-amber-700",
        tone === "danger" && "bg-red-100 text-red-700",
        tone === "muted" && "bg-muted text-subtle",
      )}
    >
      {statusLabels[status] || status}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-subtle">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime/70 text-ink">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function EntryFilesCard({
  entry,
  onXmlAction,
  onDanfeAction,
}: {
  entry: NfeEntry;
  onXmlAction: (action: "view" | "download" | "print") => void;
  onDanfeAction: (action: "view" | "download" | "print") => void;
}) {
  const xmlFileName = `nfe-entrada-${entry.accessKey}.xml`;
  const danfeFileName = `danfe-nfe-entrada-${entry.accessKey}.html`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Arquivos da entrada</h3>
          <p className="text-xs text-subtle">XML e DANFE recebidos pela API com as mesmas ações do fluxo de saída.</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2">
          <div className="min-w-0">
            <div className="font-bold">XML da NF-e</div>
            <div className="mt-0.5 truncate text-xs text-subtle">{xmlFileName}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" title="Visualizar XML" onClick={() => onXmlAction("view")}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Baixar XML" onClick={() => onXmlAction("download")}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Imprimir XML" onClick={() => onXmlAction("print")}>
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2">
          <div className="min-w-0">
            <div className="font-bold">DANFE</div>
            <div className="mt-0.5 truncate text-xs text-subtle">{danfeFileName}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" title="Visualizar DANFE" onClick={() => onDanfeAction("view")}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Baixar DANFE" onClick={() => onDanfeAction("download")}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Imprimir DANFE" onClick={() => onDanfeAction("print")}>
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function downloadText(filename: string, content: string, type = "application/xml;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadUrlFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener noreferrer";
  link.click();
}

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openPreviewUrl(url: string, print = false) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  opened?.focus();
  if (print) {
    window.setTimeout(() => opened?.print?.(), 500);
  }
}

function htmlToBlob(html: string) {
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

function openCteDetail(cteId: string) {
  if (!cteId) return;
  window.open(`/cte/${cteId}`, "_blank", "noopener,noreferrer");
}

function openBlobFile(blob: Blob, filename: string, action: "view" | "download" | "print") {
  if (action === "download") {
    downloadBlobFile(blob, filename);
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  openPreviewUrl(objectUrl, action === "print");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function NfeEntryView() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [danfeArtifact, setDanfeArtifact] = useState<NfeEntryDanfeArtifact | null>(null);
  const [danfePreviewUrl, setDanfePreviewUrl] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, { productId: string; ignoreStock: boolean }>>({});
  const pageSize = 10;

  const listQuery = useQuery({
    queryKey: ["nfe-entry", page, pageSize, filters],
    queryFn: () => listNfeEntries({ page, pageSize, filters }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ["nfe-entry-detail", selectedId],
    queryFn: () => getNfeEntry(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const productsQuery = useQuery({
    queryKey: ["nfe-entry-products"],
    queryFn: () => searchNfeProducts("", 80),
  });

  const action = useMutation({
    mutationFn: async (work: () => Promise<{ message?: string } | unknown>) => work(),
    onSuccess: (result) => {
      const message = typeof result === "object" && result && "message" in result ? String((result as { message?: string }).message || "Acao concluida.") : "Acao concluida.";
      notify({ title: message });
      queryClient.invalidateQueries({ queryKey: ["nfe-entry"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["nfe-entry-detail", selectedId] });
    },
    onError: (error) => notify({ title: "Acao nao concluida", description: (error as Error).message, tone: "error" }),
  });

  const selected = detailQuery.data?.data;
  const response = listQuery.data ?? {
    data: [],
    summary: { total: 0, pendingManifestation: 0, pendingEntry: 0, confirmed: 0, divergence: 0, cancelled: 0 },
    pagination: { page, pageSize, total: 0, totalPages: 1 },
  };

  useEffect(() => {
    if (!selected?.items) return;
    const next: Record<string, { productId: string; ignoreStock: boolean }> = {};
    selected.items.forEach((item) => {
      next[item.id] = { productId: item.productId || "", ignoreStock: item.stockIgnored };
    });
    setLinkDraft(next);
  }, [selected?.id, selected?.items]);

  useEffect(() => {
    if (!danfeArtifact) {
      setDanfePreviewUrl(null);
      return;
    }

    if (danfeArtifact.kind === "link") {
      setDanfePreviewUrl(danfeArtifact.url || danfeArtifact.storageKey || null);
      return;
    }

    const blob = danfeArtifact.kind === "blob" ? danfeArtifact.blob : htmlToBlob(danfeArtifact.html);
    const url = URL.createObjectURL(blob);
    setDanfePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [danfeArtifact]);

  function updateFilter<K extends keyof NfeEntryFilters>(key: K, value: NfeEntryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  async function handleImport(file?: File | null) {
    if (!file) return;
    action.mutate(() => importNfeEntryXml(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleXmlFileAction(entry: NfeEntry, action: "view" | "download" | "print") {
    try {
      const result = await getNfeEntryXml(entry.id);
      const fileName = `nfe-entrada-${entry.accessKey}.xml`;
      if (action === "download") {
        downloadText(fileName, result.xml);
        notify({ title: "XML baixado", description: entry.accessKey });
        return;
      }

      openBlobFile(new Blob([result.xml], { type: "application/xml;charset=utf-8" }), fileName, action);
      notify({
        title: action === "view" ? "XML aberto" : "Impressão preparada",
        description: entry.accessKey,
      });
    } catch (error) {
      notify({ title: "XML nao baixado", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleDanfe(entry: NfeEntry) {
    try {
      const result = await getNfeEntryDanfe(entry.id);
      setDanfeArtifact(result.data);
    } catch (error) {
      notify({ title: "DANFE nao carregado", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleDanfeFileAction(entry: NfeEntry, action: "view" | "download" | "print") {
    try {
      const result = await getNfeEntryDanfe(entry.id);
      const artifact = result.data;

      if (artifact.kind === "blob") {
        if (action === "download") {
          downloadBlobFile(artifact.blob, artifact.fileName);
        } else {
          openBlobFile(artifact.blob, artifact.fileName, action);
        }
        notify({
          title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
          description: artifact.message || "Arquivo binário preparado pela API.",
        });
        return;
      }

      if (artifact.kind === "link") {
        const url = artifact.url || artifact.storageKey;
        if (!url) return;
        if (action === "download") {
          downloadUrlFile(url, artifact.fileName || "danfe-nfe-entrada.pdf");
        } else {
          openPreviewUrl(url, action === "print");
        }
        notify({
          title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
          description: artifact.message || "Arquivo disponível pela API.",
        });
        return;
      }

      if (action === "download") {
        downloadText(artifact.fileName, artifact.html, artifact.mimeType);
      } else {
        openBlobFile(htmlToBlob(artifact.html), artifact.fileName, action);
      }
      notify({
        title: action === "view" ? "DANFE aberto" : action === "download" ? "Download iniciado" : "Impressão preparada",
        description: artifact.message || "Arquivo HTML preparado pela API.",
      });
    } catch (error) {
      notify({ title: "DANFE nao carregado", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleCteXmlAction(cteId: string, accessKey: string | null | undefined, action: "view" | "download" | "print") {
    if (!cteId) return;

    try {
      const result = await getCteXml(cteId);
      const fileName = `cte-${accessKey || cteId}.xml`;
      const blob = new Blob([result.xml], { type: "application/xml;charset=utf-8" });

      openBlobFile(blob, fileName, action);
      notify({
        title: action === "view" ? "CT-e aberto" : action === "download" ? "XML do CT-e baixado" : "Impressão preparada",
        description: accessKey || cteId,
      });
    } catch (error) {
      notify({ title: "CT-e nao carregado", description: (error as Error).message, tone: "error" });
    }
  }

  function handleDanfeAction(action: "view" | "download" | "print") {
    if (!danfeArtifact) return;

    if (danfeArtifact.kind === "blob") {
      if (action === "download") {
        downloadBlobFile(danfeArtifact.blob, danfeArtifact.fileName);
      } else {
        const url = URL.createObjectURL(danfeArtifact.blob);
        openPreviewUrl(url, action === "print");
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }

    if (danfeArtifact.kind === "link") {
      const url = danfeArtifact.url || danfeArtifact.storageKey;
      if (!url) return;
      if (action === "download") {
        downloadUrlFile(url, danfeArtifact.fileName || "danfe-nfe-entrada.pdf");
      } else {
        openPreviewUrl(url, action === "print");
      }
      return;
    }

    if (action === "download") {
      downloadText(danfeArtifact.fileName, danfeArtifact.html, danfeArtifact.mimeType);
      return;
    }

    const url = URL.createObjectURL(htmlToBlob(danfeArtifact.html));
    openPreviewUrl(url, action === "print");
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function critical(question: string, run: () => Promise<unknown>) {
    if (window.confirm(question)) action.mutate(run);
  }

  function saveProductLinks() {
    if (!selected) return;
    const links = Object.entries(linkDraft).map(([itemId, value]) => ({
      itemId,
      productId: value.productId || null,
      ignoreStock: value.ignoreStock,
    }));
    action.mutate(() => linkNfeEntryProducts(selected.id, links));
  }

  return (
    <>
      <PageHeader
        eyebrow="DF-e / Entrada"
        title="NF-e Entrada"
        description="Documentos fiscais recebidos contra a empresa, com manifestacao, estoque, financeiro, CT-e e FiscalAI."
        icon={Truck}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={action.isPending}>
              <Upload className="h-4 w-4" />
              Importar XML
            </Button>
            <Button variant="lime" onClick={() => action.mutate(() => syncNfeEntries())} disabled={action.isPending}>
              <RefreshCw className={cn("h-4 w-4", action.isPending && "animate-spin")} />
              Sincronizar DF-e
            </Button>
            <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(event) => handleImport(event.target.files?.[0])} />
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total sincronizadas" value={response.summary.total} icon={FileText} />
        <SummaryCard label="Pendentes manifestacao" value={response.summary.pendingManifestation} icon={ShieldAlert} />
        <SummaryCard label="Pendentes entrada" value={response.summary.pendingEntry} icon={PackageCheck} />
        <SummaryCard label="Entradas confirmadas" value={response.summary.confirmed} icon={CheckCircle2} />
        <SummaryCard label="Com divergencia fiscal" value={response.summary.divergence} icon={AlertTriangle} />
        <SummaryCard label="Canceladas" value={response.summary.cancelled} icon={Ban} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} className="pl-9" placeholder="Buscar fornecedor, CNPJ, chave ou numero" />
          </div>
          <Input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
          <Input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
          <Input value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} placeholder="Fornecedor" />
          <Input value={filters.number} onChange={(event) => updateFilter("number", event.target.value)} placeholder="Numero" />
          <Input value={filters.accessKey} onChange={(event) => updateFilter("accessKey", event.target.value)} placeholder="Chave" />
        </div>
        <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-6">
          <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">Status</option>
            {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" value={filters.manifestation} onChange={(event) => updateFilter("manifestation", event.target.value)}>
            <option value="">Manifestacao</option>
            <option value="PENDENTE_MANIFESTACAO">Pendente</option>
            <option value="MANIFESTADA_CIENCIA">Ciencia</option>
            <option value="MANIFESTADA_CONFIRMACAO">Confirmacao</option>
            <option value="MANIFESTADA_DESCONHECIMENTO">Desconhecimento</option>
            <option value="MANIFESTADA_NAO_REALIZADA">Nao realizada</option>
          </select>
          <select className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" value={filters.stock} onChange={(event) => updateFilter("stock", event.target.value)}>
            <option value="">Entrada estoque</option>
            <option value="PENDENTE_ESTOQUE">Pendente</option>
            <option value="ESTOQUE_LANCADO">Lancado</option>
          </select>
          <Input value={filters.series} onChange={(event) => updateFilter("series", event.target.value)} placeholder="Serie" />
          <Input value={filters.minAmount} onChange={(event) => updateFilter("minAmount", event.target.value)} placeholder="Valor minimo" />
          <div className="flex gap-2">
            <Input value={filters.maxAmount} onChange={(event) => updateFilter("maxAmount", event.target.value)} placeholder="Valor maximo" />
            <Button variant="outline" size="icon" title="Limpar filtros" onClick={() => setFilters(initialFilters)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase text-subtle">
              <tr>
                {["Data emissao", "Fornecedor", "CNPJ", "Numero", "Serie", "Chave de acesso", "Valor total", "SEFAZ", "Manifestacao", "Entrada", "Acoes"].map((head) => (
                  <th key={head} className="border-b border-line px-4 py-3 font-extrabold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listQuery.isFetching && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm font-semibold text-subtle">Carregando NF-e de entrada...</td></tr>
              )}
              {!listQuery.isFetching && response.data.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-subtle">Nenhuma NF-e de entrada encontrada. Sincronize DF-e ou importe um XML.</td></tr>
              )}
              {!listQuery.isFetching && response.data.map((entry) => (
                <tr key={entry.id} className="border-b border-line hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{formatDate(entry.issueDate)}</td>
                  <td className="max-w-56 px-4 py-3"><p className="truncate font-bold">{entry.supplierName || "-"}</p><p className="text-[11px] text-subtle">Score {entry.riskScore} - {entry.recommendation}</p></td>
                  <td className="px-4 py-3">{entry.supplierCnpj ? maskCnpj(entry.supplierCnpj) : "-"}</td>
                  <td className="px-4 py-3 font-bold">{entry.number || "-"}</td>
                  <td className="px-4 py-3">{entry.series || "-"}</td>
                  <td className="max-w-72 px-4 py-3 font-mono text-[11px]"><span className="block truncate">{entry.accessKey}</span></td>
                  <td className="px-4 py-3 font-extrabold">{formatCurrency(entry.totalAmount)}</td>
                  <td className="px-4 py-3"><StatusBadge value={entry.sefazStatus || "AUTHORIZED"} /></td>
                  <td className="px-4 py-3"><StatusBadge value={entry.manifestationStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge value={entry.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setSelectedId(entry.id)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Baixar XML" onClick={() => void handleXmlFileAction(entry, "download")}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Imprimir XML" onClick={() => void handleXmlFileAction(entry, "print")}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Visualizar DANFE" onClick={() => handleDanfe(entry)}><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Manifestar" onClick={() => { setSelectedId(entry.id); notify({ title: "Escolha o evento no painel de detalhes." }); }}><ShieldAlert className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Confirmar entrada" onClick={() => critical("Confirmar entrada e movimentar estoque?", () => confirmNfeEntry(entry.id))}><PackageCheck className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Vincular produtos" onClick={() => { setSelectedId(entry.id); action.mutate(() => autoLinkNfeEntryProducts(entry.id)); }}><Link2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Gerar financeiro" onClick={() => critical("Gerar contas a pagar para esta NF-e?", () => generateNfeEntryPayables(entry.id))}><ReceiptText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Ignorar documento" onClick={() => critical("Ignorar este documento no fluxo de entrada?", () => ignoreNfeEntry(entry.id, "Ignorado pelo usuario"))}><Ban className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Ver historico" onClick={() => setSelectedId(entry.id)}><History className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-subtle">{response.pagination.total} registro(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
            <span className="text-xs font-bold">Pagina {page} de {response.pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= response.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Proxima</Button>
          </div>
        </div>
      </Card>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
          <button className="absolute inset-0" aria-label="Fechar detalhes" onClick={() => setSelectedId(null)} />
          <aside className="relative h-full w-full max-w-5xl overflow-y-auto bg-white p-5 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-subtle">Detalhes da entrada</p>
                <h2 className="mt-1 text-2xl font-extrabold">NF-e {selected?.number || ""}</h2>
                <p className="mt-1 font-mono text-[11px] text-subtle">{selected?.accessKey}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button>
            </div>

            {detailQuery.isFetching && <Card className="p-8 text-center text-sm text-subtle">Carregando detalhes...</Card>}
            {selected && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Card className="p-4"><p className="text-xs text-subtle">Fornecedor</p><p className="mt-1 font-extrabold">{selected.supplierName || "-"}</p></Card>
                  <Card className="p-4"><p className="text-xs text-subtle">Valor</p><p className="mt-1 font-extrabold">{formatCurrency(selected.totalAmount)}</p></Card>
                  <Card className="p-4"><p className="text-xs text-subtle">Risco FiscalAI</p><p className="mt-1 font-extrabold">{selected.riskScore}/100 - {selected.recommendation}</p></Card>
                  <Card className="p-4"><p className="text-xs text-subtle">CT-e</p><p className="mt-1"><StatusBadge value={selected.cteStatus} /></p></Card>
                </div>

                <EntryFilesCard
                  entry={selected}
                  onXmlAction={(action) => void handleXmlFileAction(selected, action)}
                  onDanfeAction={(action) => void handleDanfeFileAction(selected, action)}
                />

                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => action.mutate(() => validateNfeEntry(selected.id))}>Validar entrada</Button>
                    <Button size="sm" variant="outline" onClick={() => action.mutate(() => manifestNfeEntry(selected.id, "CIENCIA"))}>Ciencia</Button>
                    <Button size="sm" variant="outline" onClick={() => action.mutate(() => manifestNfeEntry(selected.id, "CONFIRMACAO"))}>Confirmacao</Button>
                    <Button size="sm" variant="outline" onClick={() => critical("Manifestar desconhecimento da operacao?", () => manifestNfeEntry(selected.id, "DESCONHECIMENTO"))}>Desconhecimento</Button>
                    <Button size="sm" variant="outline" onClick={() => critical("Manifestar operacao nao realizada?", () => manifestNfeEntry(selected.id, "NAO_REALIZADA", "Operacao nao realizada pelo destinatario."))}>Nao realizada</Button>
                    <Button size="sm" variant="lime" onClick={saveProductLinks}>Salvar vinculos</Button>
                    <Button size="sm" variant="outline" onClick={() => action.mutate(() => prepareNfeEntryInventory(selected.id))}>Preparar estoque</Button>
                    <Button size="sm" variant="lime" disabled={selected.stockStatus !== "READY_TO_POST"} onClick={() => critical("Confirmar entrada e movimentar estoque?", () => postNfeEntryInventory(selected.id))}>Confirmar entrada</Button>
                    <Button size="sm" variant="outline" onClick={() => critical("Preparar este documento para SPED e SINTEGRA?", () => prepareNfeEntryBookkeeping(selected.id))}>Preparar SPED</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-muted/60 text-[11px] uppercase text-subtle">
                        <tr>{["#", "Produto XML", "NCM", "Qtd", "Valor", "Produto interno", "Ignorar estoque"].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr>
                      </thead>
                      <tbody>
                        {selected.items?.map((item) => (
                          <tr key={item.id} className="border-b border-line">
                            <td className="px-3 py-2 font-bold">{item.itemNumber}</td>
                            <td className="px-3 py-2"><p className="font-semibold">{item.description}</p><p className="text-[11px] text-subtle">{item.supplierProductCode}</p></td>
                            <td className="px-3 py-2">{item.ncm || "-"}</td>
                            <td className="px-3 py-2">{item.quantity}</td>
                            <td className="px-3 py-2">{formatCurrency(item.totalValue)}</td>
                            <td className="px-3 py-2">
                              <select
                                className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
                                value={linkDraft[item.id]?.productId || ""}
                                onChange={(event) => setLinkDraft((current) => ({ ...current, [item.id]: { productId: event.target.value, ignoreStock: false } }))}
                              >
                                <option value="">Selecione</option>
                                {(productsQuery.data || []).map((product: Product) => (
                                  <option key={product.id} value={product.id}>{product.code} - {product.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(linkDraft[item.id]?.ignoreStock)}
                                onChange={(event) => setLinkDraft((current) => ({ ...current, [item.id]: { productId: "", ignoreStock: event.target.checked } }))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <h3 className="font-extrabold">Alertas FiscalAI</h3>
                    <div className="mt-3 space-y-2">
                      {!selected.alerts?.length && <p className="text-sm text-subtle">Nenhuma divergencia fiscal aberta.</p>}
                      {selected.alerts?.map((alert) => (
                        <div key={alert.id} className="rounded-xl border border-line p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold">{alert.title}</p>
                            <StatusBadge value={alert.severity === "error" ? "COM_DIVERGENCIA" : "PENDENTE_VALIDACAO"} />
                          </div>
                          <p className="mt-1 text-sm text-subtle">{alert.message}</p>
                          {alert.recommendation && <p className="mt-2 text-xs font-bold text-ink">{alert.recommendation}</p>}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-extrabold">Historico / Timeline</h3>
                    <div className="mt-3 space-y-3">
                      {selected.events?.map((event) => (
                        <div key={event.id} className="relative border-l-2 border-line pl-4">
                          <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-lime" />
                          <p className="font-bold">{event.title}</p>
                          <p className="text-xs text-subtle">{formatDateTime(event.createdAt)}</p>
                          {event.description && <p className="mt-1 text-sm text-subtle">{event.description}</p>}
                        </div>
                      ))}
                      {!selected.events?.length && <p className="text-sm text-subtle">Nenhum evento registrado.</p>}
                    </div>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <h3 className="font-extrabold">Financeiro a pagar</h3>
                    <div className="mt-3 space-y-2">
                      {!selected.payables?.length && <p className="text-sm text-subtle">Nenhuma conta a pagar gerada.</p>}
                      {selected.payables?.map((payable) => (
                        <div key={payable.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                          <span>Parcela {payable.installmentNumber} - {formatDate(payable.dueDate)}</span>
                          <strong>{formatCurrency(payable.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <h3 className="font-extrabold">CT-e vinculado</h3>
                    <div className="mt-3 space-y-2">
                      {!selected.cteLinks?.length && <p className="text-sm text-subtle">Nenhum CT-e vinculado a esta NF-e.</p>}
                      {selected.cteLinks?.map((link) => (
                        <div key={link.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-bold">{link.cteEntry?.carrierName || "CT-e"}</p>
                            <p className="truncate font-mono text-[10px] text-subtle">{link.cteEntry?.accessKey || "Chave nao informada"}</p>
                            <p className="text-subtle">Frete rateado: {formatCurrency(link.freightShare)}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Abrir CT-e"
                              disabled={!link.cteEntry?.id}
                              onClick={() => openCteDetail(link.cteEntry?.id || "")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Baixar XML"
                              disabled={!link.cteEntry?.id}
                              onClick={() => void handleCteXmlAction(link.cteEntry?.id || "", link.cteEntry?.accessKey, "download")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Imprimir XML"
                              disabled={!link.cteEntry?.id}
                              onClick={() => void handleCteXmlAction(link.cteEntry?.id || "", link.cteEntry?.accessKey, "print")}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {danfeArtifact && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <Card className="max-h-[85vh] w-full max-w-3xl overflow-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold">Visualizar DANFE</h3>
                <p className="text-xs font-semibold text-subtle">{danfeArtifact.kind === "html" ? danfeArtifact.accessKey : "Documento de entrada"}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setDanfeArtifact(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              <iframe
                title="Visualização DANFE"
                src={danfePreviewUrl || undefined}
                className="h-[55vh] w-full"
                sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => handleDanfeAction("view")}>
                <Eye className="h-4 w-4" />
                Abrir DANFE
              </Button>
              <Button variant="outline" onClick={() => handleDanfeAction("download")}>
                <FileDown className="h-4 w-4" />
                Baixar DANFE
              </Button>
              <Button variant="outline" onClick={() => handleDanfeAction("print")}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
