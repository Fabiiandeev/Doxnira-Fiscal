"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadFiscalReport, getAccountingSummary } from "@/lib/services/tax-service";
import { formatCurrency, formatDate } from "@/lib/utils";

export function AccountingReportsView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const query = useQuery({
    queryKey: ["accounting-report", year, month],
    queryFn: () => getAccountingSummary(year, month),
  });
  const data = query.data;
  return (
    <>
      <PageHeader
        eyebrow="Contabilidade"
        title="Relatórios contábeis"
        description="Entradas, saídas, CT-e, pendências e impostos estimados do período."
        icon={FileBarChart}
        action={<div className="flex flex-wrap gap-2"><select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 rounded-xl border border-line bg-white px-3 text-xs">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 w-24 rounded-xl border border-line bg-white px-3 text-xs" /><Button variant="outline" onClick={() => downloadFiscalReport("reports", "csv", { periodYear: year, periodMonth: month })}><Download className="h-4 w-4" />CSV</Button><Button variant="lime" onClick={() => downloadFiscalReport("reports", "xlsx", { periodYear: year, periodMonth: month })}><Download className="h-4 w-4" />XLSX</Button></div>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="NF-e Entradas" value={formatCurrency(data?.totals.inbound || 0)} />
        <Metric label="NF-e Saídas" value={formatCurrency(data?.totals.outbound || 0)} />
        <Metric label="CT-e / Fretes" value={formatCurrency(data?.totals.freight || 0)} />
        <Metric label="Impostos estimados" value={formatCurrency(data?.totals.taxes || 0)} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4 text-[10px] font-bold text-subtle"><span>{data?.totals.cancelled || 0} canceladas</span><span>{data?.totals.missingXml || 0} sem XML completo</span><span>{data?.totals.linkedCte || 0} com CT-e</span><span>{data?.ignoredDocuments || 0} MOCK/SEED ignorados</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="bg-muted text-[9px] font-extrabold uppercase text-subtle"><tr><th className="px-5 py-3">Tipo</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Tributos</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{(data?.documents || []).map((document) => <tr key={`${document.accessKey}-${document.operationDirection}`} className="border-t border-line"><td className="px-5 py-3 font-extrabold">{document.documentType}</td><td className="px-4 py-3">{document.operationDirection}</td><td className="px-4 py-3">{document.invoiceNumber || "—"}</td><td className="px-4 py-3">{document.emissionDate ? formatDate(document.emissionDate) : "—"}</td><td className="px-4 py-3">{document.source}</td><td className="px-4 py-3 font-extrabold">{formatCurrency(document.totalAmount)}</td><td className="px-4 py-3">{formatCurrency(document.taxAmount)}</td><td className="px-4 py-3">{document.status}</td></tr>)}</tbody></table>{!query.isLoading && !data?.documents.length && <p className="p-12 text-center text-xs text-subtle">Nenhum documento real/importado no período.</p>}</div>
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-5"><p className="text-[10px] font-bold text-subtle">{label}</p><p className="mt-3 text-xl font-extrabold">{value}</p></Card>;
}
