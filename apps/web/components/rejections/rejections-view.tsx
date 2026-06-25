"use client";

import { RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatDate } from "@/lib/utils";

export function RejectionsView() {
  const mockRejections = [
    { id: "rej-1", accessKey: "35260612345678000123550010000000011000000001", number: "001234", company: "Gama Tech", reason: "Rejeicao 205: NF-e ja cadastrada", severity: "CRITICAL", date: "2026-06-20", status: "PENDING" },
    { id: "rej-2", accessKey: "35260612345678000123550010000000021000000002", number: "001235", company: "Beta Servicos", reason: "Rejeicao 217: CFOP invalido", severity: "HIGH", date: "2026-06-19", status: "FIXED" },
    { id: "rej-3", accessKey: "35260612345678000123550010000000031000000003", number: "001236", company: "Delta Autopecas", reason: "Rejeicao 720: CST incompativel", severity: "HIGH", date: "2026-06-18", status: "PENDING" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">Rejeicoes</h1><p className="text-sm text-subtle">Notas fiscais rejeitadas pela SEFAZ</p></div><Button variant="lime" onClick={() => notify({ title: "Revalidando..." })}><RefreshCw className="h-4 w-4" /> Revalidar</Button></div>
      <Card className="p-4"><Input placeholder="Buscar por chave, numero, empresa..." className="max-w-sm" /></Card>
      <Card className="overflow-hidden">
        <table className="w-full"><thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Nota</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead><tbody className="divide-y divide-line">{mockRejections.map((r) => (<tr key={r.id} className="hover:bg-muted/30"><td className="px-4 py-3 font-mono text-sm">{r.number}</td><td className="px-4 py-3">{r.company}</td><td className="px-4 py-3">{r.reason}</td><td className="px-4 py-3"><Badge variant={r.severity === "CRITICAL" ? "destructive" : "warning"}>{r.severity}</Badge></td><td className="px-4 py-3">{formatDate(r.date)}</td><td className="px-4 py-3"><Badge variant={r.status === "FIXED" ? "success" : "outline"}>{r.status}</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm">Corrigir</Button><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></div></td></tr>))}</tbody></table>
      </Card>
    </div>
  );
}

