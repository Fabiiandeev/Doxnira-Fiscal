"use client";

import { useState, useEffect } from "react";
import { Building2, CircleDollarSign, Download, FileBarChart, FileCheck2, FileText, Send, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccountantValueReport, generateValueReportPDF, exportValueReportCSV } from "@/lib/services/fiscal/accountant-value-report-service";
import type { AccountantValueReport } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

export function AccountantValueReportView() {
  const [report, setReport] = useState<AccountantValueReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const data = await getAccountantValueReport(); setReport(data); setLoading(false); };
    load();
  }, []);

  const handleExportPDF = async () => {
    const blob = await generateValueReportPDF(report?.period || "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-valor-${report?.period?.replace("/", "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: "PDF gerado" });
  };

  const handleExportCSV = async () => {
    const blob = await exportValueReportCSV(report?.period || "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-valor-${report?.period?.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: "CSV exportado" });
  };

  if (!report) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Relatorio: O que o contador fez</h1><p className="text-sm text-subtle">Periodo: {report.period}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={handleExportPDF}><FileText className="h-4 w-4" /> PDF</Button><Button variant="outline" onClick={handleExportCSV}><Download className="h-4 w-4" /> CSV</Button><Button variant="lime" onClick={() => notify({ title: "Enviado ao cliente por WhatsApp/Email" })}><Send className="h-4 w-4" /> Enviar cliente</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="p-4 text-center"><FileCheck2 className="h-8 w-8 mx-auto text-emerald-500" /><p className="mt-2 text-sm font-bold">Docs validados</p><p className="text-2xl font-extrabold">{report.validatedDocuments}</p></Card>
        <Card className="p-4 text-center"><FileBarChart className="h-8 w-8 mx-auto text-blue-500" /><p className="mt-2 text-sm font-bold">Produtos classificados</p><p className="text-2xl font-extrabold">{report.classifiedProducts}</p></Card>
        <Card className="p-4 text-center"><TrendingUp className="h-8 w-8 mx-auto text-lime" /><p className="mt-2 text-sm font-bold">Rejeicoes corrigidas</p><p className="text-2xl font-extrabold">{report.correctedRejections}</p></Card>
        <Card className="p-4 text-center"><FileBarChart className="h-8 w-8 mx-auto text-purple-500" /><p className="mt-2 text-sm font-bold">CT-e vinculados</p><p className="text-2xl font-extrabold">{report.linkedCtes}</p></Card>
        <Card className="p-4 text-center"><FileText className="h-8 w-8 mx-auto text-orange-500" /><p className="mt-2 text-sm font-bold">Guias conferidas</p><p className="text-2xl font-extrabold">{report.verifiedGuides}</p></Card>
        <Card className="p-4 text-center"><CircleDollarSign className="h-8 w-8 mx-auto text-red-500" /><p className="mt-2 text-sm font-bold">Notas destravadas</p><p className="text-2xl font-extrabold">{formatCurrency(report.unlockedAmount)}</p></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Detalhamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Descricao</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Valor</th></tr></thead>
            <tbody className="divide-y divide-line">
              {report.details.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{d.type}</td>
                  <td className="px-4 py-3">{d.description}</td>
                  <td className="px-4 py-3 text-center font-bold">{d.count}</td>
                  <td className="px-4 py-3 text-right font-bold">{d.amount ? formatCurrency(d.amount) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Card>
    </div>
  );
}

