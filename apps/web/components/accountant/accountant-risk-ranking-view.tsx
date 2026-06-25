"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Building2, Target, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccountantRiskRanking } from "@/lib/services/fiscal/accountant-service";
import type { AccountantRiskRanking } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

const riskColors = { CRITICAL: "bg-red-50 text-red-700", HIGH: "bg-orange-50 text-orange-700", MEDIUM: "bg-yellow-50 text-yellow-700", LOW: "bg-green-50 text-green-700" };

export function AccountantRiskRankingView() {
  const [data, setData] = useState<AccountantRiskRanking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const d = await getAccountantRiskRanking(); setData(d); setLoading(false); };
    load();
  }, []);

  if (!data) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Ranking de Risco - Contador</h1><p className="text-sm text-subtle">Empresas ordenadas por criticidade fiscal</p></div>
        <div className="flex gap-2">
          <Badge variant="destructive">Critico: {data.summary.critical}</Badge>
          <Badge variant="warning">Alto: {data.summary.high}</Badge>
          <Badge variant="default">Medio: {data.summary.medium}</Badge>
          <Badge variant="success">Baixo: {data.summary.low}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Risco</th><th className="px-4 py-3">Principal problema</th><th className="px-4 py-3">Impacto financeiro</th><th className="px-4 py-3">Acao</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.companies.map((company) => (
              <tr key={company.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><Building2 className="h-4 w-4 inline mr-2" />{company.name}</td>
                <td className="px-4 py-3 font-extrabold text-xl">{company.score}/100</td>
                <td className="px-4 py-3"><Badge className={riskColors[company.riskLevel]}>{company.riskLevel}</Badge></td>
                <td className="px-4 py-3 text-red-500">{company.mainIssue}</td>
                <td className="px-4 py-3 font-bold">{formatCurrency(company.financialImpact)}</td>
                <td className="px-4 py-3">
                  <Button variant={company.riskLevel === "CRITICAL" ? "default" : company.riskLevel === "HIGH" ? "outline" : "ghost"} size="sm">{company.action}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

