"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Building2, CircleDollarSign, Filter, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTaxReformImpact, applyTaxReform applyTaxReformRule, generateAdequationPlan } from "@/lib/services/fiscal/tax-reform-service";
import type { TaxReformImpact } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors = { PENDING: "bg-blue-50 text-blue-700", APPLIED: "bg-green-50 text-green-700", REVIEW: "bg-yellow-50 text-yellow-700", IGNORED: "bg-gray-50 text-gray-700" };
const typeIcons = { product: "??", service: "???" };

export function TaxReformView() {
  const [data, setData] = useState<TaxReformImpact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const d = await getTaxReformImpact(); setData(d); setLoading(false); };
    load();
  }, []);

  if (!data) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Radar IBS/CBS</h1><p className="text-sm text-subtle">Analise de impacto da reforma tributaria</p></div>
        <div className="flex gap-2"><Button variant="lime" onClick={async () => { const plan = await generateAdequationPlan(); notify({ title: "Plano gerado", description: plan.timeline }); }}>Gerar plano adequacao</Button><Button variant="outline" onClick={() => loadData()}><RefreshCw className="h-4 w-4" /> Atualizar</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><Building2 className="h-6 w-6 text-blue-500" /><p className="mt-2 text-sm font-bold">Empresas analisadas</p><p className="text-2xl font-extrabold">{data.companiesAnalyzed}</p></Card>
        <Card className="p-4"><TrendingUp className="h-6 w-6 text-green-500" /><p className="mt-2 text-sm font-bold">Produtos impactados</p><p className="text-2xl font-extrabold">{data.productsImpacted}</p></Card>
        <Card className="p-4"><CircleDollarSign className="h-6 w-6 text-purple-500" /><p className="mt-2 text-sm font-bold">Servicos impactados</p><p className="text-2xl font-extrabold">{data.servicesImpacted}</p></Card>
        <Card className="p-4"><AlertTriangle className="h-6 w-6 text-orange-500" /><p className="mt-2 text-sm font-bold">Regras pendentes</p><p className="text-2xl font-extrabold">{data.pendingRules}</p></Card>
        <Card className="p-4"><Target className="h-6 w-6 text-red-500" /><p className="mt-2 text-sm font-bold">Alto risco</p><p className="text-2xl font-extrabold">{data.highRiskCompanies}</p></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Itens de impacto</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CNAE</th><th className="px-4 py-3">CFOP</th><th className="px-4 py-3">CST atual</th><th className="px-4 py-3">cClassTrib</th><th className="px-4 py-3">IBS%</th><th className="px-4 py-3">CBS%</th><th className="px-4 py-3">Docs</th><th className="px-4 py-3">Empresas</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{typeIcons[item.entityType]}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.cnae}</td>
                  <td className="px-4 py-3">{item.cfop}</td>
                  <td className="px-4 py-3">{item.currentCst}</td>
                  <td className="px-4 py-3 font-bold">{item.futureCClassTrib}</td>
                  <td className="px-4 py-3">{item.ibsRate}%</td>
                  <td className="px-4 py-3">{item.cbsRate}%</td>
                  <td className="px-4 py-3">{item.affectedDocuments}</td>
                  <td className="px-4 py-3">{item.impactedCompanies}</td>
                  <td className="px-4 py-3"><Badge className={statusColors[item.status]}>{item.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => { applyTaxReformRule(item.id); notify({ title: "Regra aplicada" }); }}>Aplicar</Button><Button variant="ghost" size="sm">Ver detalhes</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Card>
    </div>
  );
}

