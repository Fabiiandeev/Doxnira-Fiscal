"use client";

import { Download, FileText, RefreshCw, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

export function XmlCenterView() {
  const mockXmls = [
    { id: "xml-1", accessKey: "35260612345678000123550010000000011000000001", type: "NFE", direction: "ENTRADA", company: "Gama Tech", date: "2026-06-20", status: "COMPLETE", size: "45 KB" },
    { id: "xml-2", accessKey: "35260612345678000123550010000000021000000002", type: "NFE", direction: "SAIDA", company: "Beta Servicos", date: "2026-06-19", status: "COMPLETE", size: "38 KB" },
    { id: "xml-3", accessKey: "35260612345678000123550010000000031000000003", type: "CTE", direction: "ENTRADA", company: "Delta Autopecas", date: "2026-06-18", status: "SUMMARY", size: "12 KB" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">XML Fiscal</h1><p className="text-sm text-subtle">Central de XMLs completos e resumidos</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => notify({ title: "Sincronizando..." })}><RefreshCw className="h-4 w-4" /> Sincronizar</Button><Button variant="lime"><Download className="h-4 w-4" /> Exportar</Button></div></div>
      <Card className="p-4"><Input placeholder="Buscar por chave, CNPJ, empresa..." className="max-w-sm" /></Card>
      <Card className="overflow-hidden">
        <table className="w-full"><thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Chave</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Direcao</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tamanho</th><th className="px-4 py-3">Acoes</th></tr></thead><tbody className="divide-y divide-line">{mockXmls.map((x) => (<tr key={x.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-mono text-xs">{x.accessKey.slice(-12)}</td><td className="px-4 py-3">{x.type}</td><td className="px-4 py-3">{x.direction}</td><td className="px-4 py-3">{x.company}</td><td className="px-4 py-3">{formatDate(x.date)}</td><td className="px-4 py-3"><Badge variant={x.status === "COMPLETE" ? "success" : "outline"}>{x.status}</Badge></td><td className="px-4 py-3">{x.size}</td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="ghost" size="icon" title="Ver"><FileText className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Baixar"><Download className="h-4 w-4" /></Button></div></td></tr>))}</tbody></table>
      </Card>
    </div>
  );
}

