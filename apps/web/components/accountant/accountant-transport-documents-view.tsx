"use client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAccountantCompanies,
  getAccountantTransportDocuments,
  getAccountantTransportSummary,
  type AccountantCompany,
} from "@/lib/services/accountant-documents-service";
import { formatCurrency, formatDate } from "@/lib/utils";

type CteItem = {
  id: string;
  number: string | null;
  series: string | null;
  accessKey: string;
  emissionDate: string | null;
  issuerName: string | null;
  totalAmount: number;
  status: string | null;
  xmlAvailability: string;
  _count?: { nfeLinks: number };
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export function AccountantTransportDocumentsView() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AccountantCompany | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [withLinks, setWithLinks] = useState("");
  const [status, setStatus] = useState("");
  const companies = useQuery({ queryKey: ["accountant", "companies"], queryFn: listAccountantCompanies });
  const context = selected ?? companies.data?.data[0] ?? null;
  const filters = { query, ...(withLinks ? { withLinks } : {}), ...(status ? { status } : {}) };
  const list = useQuery({
    queryKey: ["accountant", context?.office.id, context?.company.id, "transport-documents", filters, page],
    queryFn: () =>
      getAccountantTransportDocuments({
        companyId: context!.company.id,
        officeId: context!.office.id,
        page,
        filters,
      }),
    enabled: Boolean(context),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["accountant", context?.office.id, context?.company.id, "transport-documents-summary"],
    queryFn: () => getAccountantTransportSummary({ companyId: context!.company.id, officeId: context!.office.id }),
    enabled: Boolean(context),
  });
  if (!context) return <Card className="p-8">Nenhuma empresa disponível.</Card>;
  const data = (list.data?.data as unknown as CteItem[]) || [];
  const pagination = (list.data?.pagination as unknown as Pagination) || { page: 1, pageSize: 25, total: 0, totalPages: 1 };
  return (
    <>
      <div className="my-5 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">CT-e</h1>
        <Button
          variant="outline"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["accountant", context.office.id, context.company.id, "transport-documents"] });
            qc.invalidateQueries({ queryKey: ["accountant", context.office.id, context.company.id, "transport-documents-summary"] });
          }}
          disabled={list.isFetching}
        >
          Atualizar
        </Button>
      </div>
      <Card className="my-5 p-4">
        <select
          value={`${context.office.id}:${context.company.id}`}
          onChange={(e) => {
            setSelected(companies.data?.data.find((x) => `${x.office.id}:${x.company.id}` === e.target.value) || null);
            setPage(1);
          }}
        >
          {companies.data?.data.map((x) => (
            <option key={`${x.office.id}:${x.company.id}`} value={`${x.office.id}:${x.company.id}`}>
              {x.company.legalName} · {x.office.name}
            </option>
          ))}
        </select>
        <div className="mt-3">
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Chave, número ou emitente"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={withLinks === "true" ? "default" : "outline"}
            onClick={() => { setWithLinks((v) => (v === "true" ? "" : "true")); setPage(1); }}
          >
            Com NF-e
          </Button>
          <Button
            size="sm"
            variant={withLinks === "false" ? "default" : "outline"}
            onClick={() => { setWithLinks((v) => (v === "false" ? "" : "false")); setPage(1); }}
          >
            Sem vínculo
          </Button>
          <Button
            size="sm"
            variant={status ? "default" : "outline"}
            onClick={() => { setStatus((s) => (s ? "" : "CANCEL")); setPage(1); }}
          >
            Cancelados
          </Button>
        </div>
      </Card>

      <Card className="my-5 p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Total", summary.data?.total],
            ["Cancelados", summary.data?.cancelled],
            ["Com NF-e", summary.data?.withLinks],
            ["Sem vínculo", summary.data?.withoutLinks],
            ["Refs pendentes", summary.data?.pendingReferences],
            ["Total R$", summary.data?.totalAmount != null ? formatCurrency(Number(summary.data.totalAmount)) : null],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded bg-muted p-3">
              <p className="text-xs text-subtle">{label}</p>
              <p className="font-bold">{String(value ?? 0)}</p>
            </div>
          ))}
        </div>
      </Card>

      {list.isError ? (
        <Card className="p-5">
          <p className="text-red-700">Falha ao carregar CT-e.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => list.refetch()}>Tentar novamente</Button>
        </Card>
      ) : list.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : !data.length ? (
        <Card className="p-5">Nenhum CT-e encontrado.</Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th>Número</th>
                <th>Série</th>
                <th>Emitente</th>
                <th>Emissão</th>
                <th>Total</th>
                <th>Status</th>
                <th>XML</th>
                <th>NF-e</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cte) => (
                <tr key={cte.id} className="border-t">
                  <td>{cte.number || "—"}</td>
                  <td>{cte.series || "—"}</td>
                  <td>{cte.issuerName || "—"}</td>
                  <td>{cte.emissionDate ? formatDate(cte.emissionDate) : "—"}</td>
                  <td>{formatCurrency(Number(cte.totalAmount || 0))}</td>
                  <td>{cte.status || "—"}</td>
                  <td>{cte.xmlAvailability}</td>
                  <td>{String(cte._count?.nfeLinks ?? 0)}</td>
                  <td>
                    <Link className="font-bold underline" href={`/accountant/transport-documents/${cte.id}?officeId=${context.office.id}&companyId=${context.company.id}`}>
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="my-5 flex justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page <= 1 || list.isFetching}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-subtle">
          Página {pagination.page} de {pagination.totalPages} · {pagination.total} CT-e
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page >= pagination.totalPages || list.isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </>
  );
}
