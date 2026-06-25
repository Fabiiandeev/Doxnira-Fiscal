"use client";

import { AlertTriangle, Building2, CheckCircle2, CircleDollarSign, RefreshCw, Search, Shield, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

export function FiscalRulesView() {
  const mockRules = [
    {
      id: "rule-1",
      code: "MOC_NFE_12_3",
      name: "IBGE obrigatorio",
      source: "MOC_NFE v3.10",
      type: "VALIDACAO",
      severity: "HIGH",
      autoFix: true,
      description: "Cliente deve ter codigo IBGE do municipio"
    },
    {
      id: "rule-2",
      code: "MOC_NFE_8_1",
      name: "XML duplicado",
      source: "MOC_NFE v3.10",
      type: "DUPLICIDADE",
      severity: "MEDIUM",
      autoFix: true,
      description: "Remover XMLs com mesma chave de acesso"
    },
    {
      id: "rule-3",
      code: "MOC_NFE_15_2",
      name: "Total divergente",
      source: "MOC_NFE v3.10",
      type: "CALCULO",
      severity: "HIGH",
      autoFix: true,
      description: "Total da nota deve igualar soma dos itens"
    },
    {
      id: "rule-4",
      code: "TIPI_8517",
      name: "NCM Smartphone",
      source: "TIPI 2024",
      type: "CLASSIFICACAO",
      severity: "MEDIUM",
      autoFix: true,
      description: "NCM 8517.12.00 para smartphones"
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Regras Fiscais</h1>
          <p className="text-sm text-subtle">Regras de validacao e classificacao fiscal (MOC, TIPI, LC 116)</p>
        </div>
        <Button variant="lime" onClick={() => notify({ title: "Atualizando regras..." })}>
          <RefreshCw className="h-4 w-4" />
          Atualizar base
        </Button>
      </div>
      <Card className="p-4">
        <Input placeholder="Buscar por codigo, nome, fonte..." className="max-w-sm" />
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-xs font-bold uppercase text-subtle">
              <th className="px-4 py-3">Codigo</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Fonte</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Severidade</th>
              <th className="px-4 py-3">Auto-fix</th>
              <th className="px-4 py-3">Descricao</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mockRules.map((r) => (
              <tr key={r.id} className="hover:bg-muted/grid/{r.id} hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-sm">{r.code}</td>,
                <td className="px-4 py-3 font-medium">{r.name}</td>,
                <td className="px-4 py-3"><Badge variant="outline">{r.source}</Badge></td>,
                <td className="px-4 py-3">{r.type}</td>,
                <td className="px-4 py-3"><Badge variant={r.severity === "HIGH" ? "destructive" : "warning"}>{r.severity}</Badge></td>,
                <td className="px-4 py-3">{r.severity}</td>,
                <td className="px-4 py-3">
                  {r.autoFix ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </td>,
                <td className="px-4 py-3 text-sm text-subtle">{r.description}</td>,
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm">Editar</Button>,
                    <Button variant="ghost" size="icon"><Shield className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}