"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentFilters } from "@/lib/types";

const selectClassName =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-ink/30 focus:ring-4 focus:ring-ink/5";

export function AdvancedFiltersDrawer({
  filters,
  onChange,
  onReset,
}: {
  filters: DocumentFilters;
  onChange: (filters: DocumentFilters) => void;
  onReset: () => void;
}) {
  const update = <K extends keyof DocumentFilters>(
    field: K,
    value: DocumentFilters[K],
  ) => onChange({ ...filters, [field]: value });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros avançados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>Filtros avançados</DialogTitle>
        <DialogDescription>
          Refine a consulta local. A mesma interface está preparada para os query params
          do endpoint server-side.
        </DialogDescription>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FilterField label="Tipo de documento">
            <select className={selectClassName} value={filters.documentType} onChange={(event) => update("documentType", event.target.value)}>
              <option value="">Todos</option>
              <option value="NFE">NF-e</option>
              <option value="CTE">CT-e</option>
            </select>
          </FilterField>
          <FilterField label="Com CT-e vinculado">
            <select className={selectClassName} value={filters.hasLinkedCte} onChange={(event) => update("hasLinkedCte", event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </FilterField>
          <FilterField label="Operação">
            <select className={selectClassName} value={filters.operationDirection} onChange={(event) => update("operationDirection", event.target.value)}>
              <option value="">Todas</option>
              <option value="INBOUND">NF-e Entrada</option>
              <option value="OUTBOUND">NF-e Saída</option>
              <option value="TRANSPORT_INBOUND">CT-e Entrada</option>
              <option value="TRANSPORT_OUTBOUND">CT-e Saída</option>
              <option value="UNKNOWN">Não classificada</option>
            </select>
          </FilterField>
          <FilterField label="Fonte">
            <select className={selectClassName} value={filters.source} onChange={(event) => update("source", event.target.value)}>
              <option value="">Todas</option>
              <option value="REAL_SEFAZ">SEFAZ real</option>
              <option value="MANUAL_IMPORT">Importação manual</option>
              <option value="ERP_IMPORT">Importação ERP</option>
              <option value="MOCK">Mock</option>
              <option value="SEED">Seed</option>
            </select>
          </FilterField>
          <FilterField label="Data inicial">
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
          </FilterField>
          <FilterField label="Data final">
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) => update("endDate", event.target.value)}
            />
          </FilterField>
          <FilterField label="Status fiscal">
            <select
              className={selectClassName}
              value={filters.status}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="AUTHORIZED">Autorizada</option>
              <option value="CANCELLED">Cancelada</option>
              <option value="EVENT">Evento</option>
            </select>
          </FilterField>
          <FilterField label="Tipo de XML">
            <select
              className={selectClassName}
              value={filters.xmlType}
              onChange={(event) => update("xmlType", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="FULL">Completo</option>
              <option value="SUMMARY">Resumo</option>
            </select>
          </FilterField>
          <FilterField label="Manifestação">
            <select
              className={selectClassName}
              value={filters.manifestation}
              onChange={(event) => update("manifestation", event.target.value)}
            >
              <option value="">Todas</option>
              <option value="PENDING">Pendente</option>
              <option value="AWARE">Ciência</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="UNKNOWN">Desconhecida</option>
            </select>
          </FilterField>
          <FilterField label="UF do emitente">
            <select
              className={selectClassName}
              value={filters.uf}
              onChange={(event) => update("uf", event.target.value)}
            >
              <option value="">Todas</option>
              {["SP", "PR", "MG", "SC", "RJ", "GO", "RS"].map((uf) => (
                <option value={uf} key={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Valor mínimo">
            <Input
              type="number"
              placeholder="0,00"
              value={filters.minAmount}
              onChange={(event) => update("minAmount", event.target.value)}
            />
          </FilterField>
          <FilterField label="Valor máximo">
            <Input
              type="number"
              placeholder="100.000,00"
              value={filters.maxAmount}
              onChange={(event) => update("maxAmount", event.target.value)}
            />
          </FilterField>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-muted p-4">
          <input
            type="checkbox"
            checked={filters.onlyNewSuppliers}
            onChange={(event) => update("onlyNewSuppliers", event.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span>
            <span className="block text-xs font-extrabold">Somente fornecedores novos</span>
            <span className="mt-1 block text-[10px] text-subtle">
              Emitentes sem histórico anterior na empresa.
            </span>
          </span>
        </label>

        <div className="mt-7 flex items-center justify-between">
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </Button>
          <DialogClose asChild>
            <Button variant="lime">Aplicar filtros</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-extrabold text-ink">{label}</span>
      {children}
    </label>
  );
}
