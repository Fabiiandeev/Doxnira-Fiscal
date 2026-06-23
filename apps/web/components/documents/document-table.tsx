"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileCheck2,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  FiscalStatusBadge,
  ManifestationBadge,
  XmlTypeBadge,
} from "@/components/status-badge";
import { ManifestationModal } from "@/components/manifestation-modal";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDocumentXml } from "@/lib/services/fiscal-service";
import type { FiscalDocument } from "@/lib/types";
import { formatCurrency, formatDate, maskCnpj } from "@/lib/utils";

export function DocumentTable({
  data,
  page,
  pageSize,
  total,
  totalPages,
  isLoading,
  onPageChange,
}: {
  data: FiscalDocument[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo<ColumnDef<FiscalDocument>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 accent-ink"
            aria-label="Selecionar todos"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 accent-ink"
            aria-label="Selecionar documento"
          />
        ),
      },
      {
        accessorKey: "invoiceNumber",
        header: "Documento",
        cell: ({ row }) => (
          <div>
            <Link
              href={`/documents/${row.original.id}`}
              className="font-extrabold text-ink hover:underline"
            >
              {documentTypeLabel(row.original)} {row.original.invoiceNumber || "—"}
            </Link>
            <p className="mt-1 text-[9px] font-bold text-subtle">
              Série {row.original.series || "—"} · NSU {row.original.nsu?.slice(-8) || "importação"}
            </p>
            <OperationBadge direction={row.original.operationDirection} />
            <SourceBadge source={row.original.source} />
          </div>
        ),
      },
      {
        accessorKey: "issuerName",
        header: "Emitente",
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <p className="truncate font-bold">{row.original.issuerName}</p>
            <p className="mt-1 text-[9px] font-semibold text-subtle">
              {maskCnpj(row.original.issuerCnpj || "")} · {row.original.uf || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "emissionDate",
        header: "Emissão",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-subtle">
            {row.original.emissionDate ? formatDate(row.original.emissionDate) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Valor",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-extrabold">
            {formatCurrency(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <FiscalStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "xmlType",
        header: "XML",
        cell: ({ row }) => <XmlTypeBadge type={row.original.xmlType} />,
      },
      {
        accessorKey: "manifestationStatus",
        header: "Manifestação",
        cell: ({ row }) => (
          <ManifestationBadge status={row.original.manifestationStatus} />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9">
              <Link href={`/documents/${row.original.id}`} aria-label="Ver detalhes">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Baixar XML"
              onClick={() => downloadXml(row.original)}
            >
              <Download className="h-4 w-4" />
            </Button>
            <ManifestationModal
              documentIds={[row.original.id]}
              trigger={
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Manifestar">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    enableRowSelection: true,
  });

  const selectedCount = table.getSelectedRowModel().rows.length;

  return (
    <div>
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-pastel-yellow px-5 py-3">
          <p className="mr-auto text-xs font-extrabold">{selectedCount} selecionada(s)</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => Promise.all(table.getSelectedRowModel().rows.map((row) => downloadXml(row.original)))}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar XMLs
          </Button>
          <ManifestationModal
            documentIds={table.getSelectedRowModel().rows.map((row) => row.original.id)}
            trigger={
              <Button variant="default" size="sm">
                <FileCheck2 className="h-3.5 w-3.5" />
                Manifestar
              </Button>
            }
          />
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1050px] text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="bg-muted/60 text-[9px] font-extrabold uppercase tracking-[0.12em] text-subtle"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 first:pl-6 last:pr-6">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={isLoading ? "opacity-45" : ""}>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-line/75 text-[11px] transition hover:bg-muted/35"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4 first:pl-6 last:pr-6">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`space-y-3 p-3 md:hidden ${isLoading ? "opacity-45" : ""}`}>
        {data.map((document) => (
          <Link
            href={`/documents/${document.id}`}
            key={document.id}
            className="block rounded-2xl border border-line bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold">{documentTypeLabel(document)} {document.invoiceNumber || "—"}</p>
                <p className="mt-1 line-clamp-1 text-[10px] font-bold text-subtle">
                  {document.issuerName}
                </p>
              </div>
              <FiscalStatusBadge status={document.status} />
            </div>
            <div className="mt-3">
              <OperationBadge direction={document.operationDirection} />
              <SourceBadge source={document.source} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">
                  {document.emissionDate ? formatDate(document.emissionDate) : "—"}
                </p>
                <p className="mt-1 text-sm font-extrabold">
                  {formatCurrency(document.totalAmount)}
                </p>
              </div>
              <XmlTypeBadge type={document.xmlType} />
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && data.length === 0 && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-extrabold">Nenhum documento fiscal encontrado</p>
          <p className="mt-2 text-xs text-subtle">
            Revise os filtros ou faça uma nova sincronização.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-bold text-subtle">
          Exibindo {data.length} de {total} documentos · {pageSize} por página
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-20 text-center text-[11px] font-extrabold">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: FiscalDocument["source"] }) {
  const isTest = source === "MOCK" || source === "SEED";
  const label = {
    REAL_SEFAZ: "Documento real SEFAZ",
    MANUAL_IMPORT: "Importação manual",
    ERP_IMPORT: "Importação ERP",
    MOCK: "Documento de teste",
    SEED: "Documento de teste",
  }[source];
  return (
    <Badge className={`mt-2 ${isTest ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
      {label}
    </Badge>
  );
}

function OperationBadge({ direction }: { direction: FiscalDocument["operationDirection"] }) {
  const label = {
    INBOUND: "NF-e Entrada",
    OUTBOUND: "NF-e Saída",
    TRANSPORT_INBOUND: "CT-e Entrada",
    TRANSPORT_OUTBOUND: "CT-e Saída",
    UNKNOWN: "Não classificada",
  }[direction];
  return <Badge className="mr-1 mt-2 bg-violet-50 text-violet-700">{label}</Badge>;
}

function documentTypeLabel(document: FiscalDocument) {
  return document.documentType === "CTE" ? "CT-e" : document.documentType === "NFE" ? "NF-e" : document.documentType;
}
  async function downloadXml(document: FiscalDocument) {
    try {
      const result = await getDocumentXml(document.id, true);
      const blob = new Blob([result.xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${document.accessKey}.xml`;
      link.click();
      URL.revokeObjectURL(url);
      notify({ title: "XML baixado", description: `NF-e ${document.invoiceNumber}` });
    } catch (error) {
      notify({ title: "Falha ao baixar XML", description: (error as Error).message, tone: "error" });
    }
  }
