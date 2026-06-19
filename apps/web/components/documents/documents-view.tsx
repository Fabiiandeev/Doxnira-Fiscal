"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdvancedFiltersDrawer } from "@/components/documents/advanced-filters-drawer";
import { DocumentTable } from "@/components/documents/document-table";
import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchDocuments } from "@/lib/services/fiscal-service";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { DocumentFilters } from "@/lib/types";

const initialFilters: DocumentFilters = {
  query: "",
  documentType: "",
  hasLinkedCte: "",
  status: "",
  xmlType: "",
  manifestation: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
  uf: "",
  onlyNewSuppliers: false,
};

export function DocumentsView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(initialFilters);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const pageSize = 10;
  const debouncedFilters = useDebouncedValue(filters, 400);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    const xmlType = params.get("xmlType");
    const status = params.get("status");
    if (query || xmlType || status) {
      setFilters((current) => ({
        ...current,
        ...(query ? { query } : {}),
        ...(xmlType ? { xmlType } : {}),
        ...(status ? { status } : {}),
      }));
    }
  }, []);

  const query = useQuery({
    queryKey: ["documents", page, pageSize, debouncedFilters, sortOrder],
    queryFn: () =>
      searchDocuments({
        page,
        pageSize,
        filters: debouncedFilters,
        sortOrder,
      }),
    placeholderData: keepPreviousData,
  });

  const response = query.data ?? {
    data: [],
    pagination: { page, pageSize, total: 0, totalPages: 1 },
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "query" && Boolean(value),
  ).length;

  function updateFilters(nextFilters: DocumentFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function exportCsv() {
    const rows = response.data.map((document) => [
      document.invoiceNumber,
      document.accessKey,
      document.issuerName,
      document.issuerCnpj,
      document.emissionDate,
      document.totalAmount,
      document.status,
      document.xmlType,
    ]);
    const csv = [
      ["numero", "chave", "emitente", "cnpj", "emissao", "valor", "status", "xml"],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "documentos-fiscais.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify({ title: "CSV exportado", description: `${response.data.length} registros da página atual.` });
  }

  function saveFilter() {
    window.localStorage.setItem("ns-fiscal-saved-filter", JSON.stringify(filters));
    notify({ title: "Filtro salvo", description: "O conjunto atual foi salvo neste navegador." });
  }

  return (
    <>
      <PageHeader
        eyebrow="Base fiscal"
        title="Documentos fiscais"
        description="Consulte NF-e por chave, CNPJ, fornecedor, número ou NSU e acompanhe a disponibilidade do XML."
        icon={FileText}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <FileSpreadsheet className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="lime" onClick={() => router.push("/sync")}>
              <RefreshCw className="h-4 w-4" />
              Sincronizar
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:p-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={filters.query}
              onChange={(event) =>
                updateFilters({ ...filters, query: event.target.value })
              }
              className="h-12 rounded-2xl bg-muted/70 pl-11 pr-10"
              placeholder="Buscar por chave, CNPJ, fornecedor, número, NSU ou protocolo..."
            />
            {filters.query && (
              <button
                onClick={() => updateFilters({ ...filters, query: "" })}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <AdvancedFiltersDrawer
            filters={filters}
            onChange={updateFilters}
            onReset={() => updateFilters(initialFilters)}
          />
          <Button variant="outline" className="md:hidden" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <p className="mr-auto text-[10px] font-bold text-subtle">
            {response.pagination.total} documentos encontrados
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => updateFilters(initialFilters)}
              className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-white"
            >
              {activeFilterCount} filtros ativos
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setSortOrder((value) => value === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-subtle"
          >
            Emissão {sortOrder === "desc" ? "↓" : "↑"}
          </button>
          <button
            onClick={saveFilter}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wider text-subtle"
          >
            <Plus className="h-3 w-3" />
            Salvar filtro
          </button>
        </div>

        <DocumentTable
          data={response.data}
          page={page}
          pageSize={pageSize}
          total={response.pagination.total}
          totalPages={response.pagination.totalPages}
          isLoading={query.isFetching}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
