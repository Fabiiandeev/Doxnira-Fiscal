"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, RefreshCw, TrendingUp, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFiscalScore, recalculateScore } from "@/lib/services/fiscal/fiscal-score-service";
import type { FiscalScoreData } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

export function FiscalScoreView() {
  const [score, setScore] = useState<FiscalScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await getFiscalScore();
    setScore(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const riskColors = { LOW: "bg-green-50 text-green-700", MEDIUM: "bg-yellow-50 text-yellow-700", HIGH: "bg-orange-50 text-orange-700", CRITICAL: "bg-red-50 text-red-700" };
  const statusColors = { OK: "bg-emerald-50 text-emerald-700", WARNING: "bg-yellow-50 text-yellow-700", ERROR: "bg-red-50 text-red-700" };

  if (!score) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Score Fiscal</h1><p className="text-sm text-subtle">Saude fiscal da empresa - {score.closingPeriod}</p></div>
        <Button variant="outline" onClick={async () => { const s = await recalculateScore(); setScore(s); notify({ title: "Score recalculado" }); }}><RefreshCw className="h-4 w-4" /> Recalcular</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 text-center"><TrendingUp className="h-10 w-10 mx-auto text-lime" /><p className="mt-2 text-sm font-bold">Score Fiscal</p><p className="text-4xl font-extrabold">{score.score}/100</p></Card>
        <Card className="p-4 text-center"><CircleDollarSign className="h-10 w-10 mx-auto text-blue-600" /><p className="mt-2 text-sm font-bold">Score Fechamento</p><p className="text-4xl font-extrabold">{score.closingScore}%</p></Card>
        <Card className="p-4 text-center"><AlertTriangle className="h-10 w-10 mx-auto" style={{color: riskColors[score.riskLevel].replace("bg-", "").replace(" text-", "")}} /><p className="mt-2 text-sm font-bold">Nivel de Risco</p><Badge className={`mt-2 ${riskColors[score.riskLevel]}`}>{score.riskLevel}</Badge></Card>
        <Card className="p-4 text-center"><CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" /><p className="mt-2 text-sm font-bold">Fechamento</p><p className="text-2xl font-extrabold">{score.closingScore}% pronto</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-bold mb-3">Itens do Score</h3>
          <div className="space-y-3">
            {score.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-line">
                <div className="flex items-center gap-3">
                  {item.status === "OK" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : item.status === "WARNING" ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  <span className="font-medium">{item.label}</span>
                  <Badge className={statusColors[item.status]}>{item.status}</Badge>
                </div>
                <span className="text-sm text-subtle">Peso: {item.weight}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3">Evolucao do Score</h3>
          <div className="space-y-2">
            {score.evolution.map((e) => (
              <div key={e.period} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="font-medium">{e.period}</span>
                <span className="text-xl font-extrabold">{e.score}/100</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-4"><h4 className="font-bold text-emerald-600 mb-2">Pontos positivos</h4><ul className="space-y-1 text-sm">{score.positivePoints.map(p => <li key={p} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{p}</li>)}</ul></Card>
        <Card className="p-4"><h4 className="font-bold text-yellow-600 mb-2">Riscos</h4><ul className="space-y-1 text-sm">{score.risks.map(r => <li key={r} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" />{r}</li>)}</ul></Card>
        <Card className="p-4"><h4 className="font-bold text-red-600 mb-2">Pendencias criticas</h4><ul className="space-y-1 text-sm">{score.criticalPendencies.map(p => <li key={p} className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" />{p}</li>)}</ul></Card>
        <Card className="p-4"><h4 className="font-bold text-blue-600 mb-2">Acoes recomendadas</h4><ul className="space-y-1 text-sm">{score.recommendedActions.map(a => <li key={a} className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" />{a}</li>)}</ul></Card>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline">Corrigir riscos</Button>
        <Button variant="outline">Ver pendencias</Button>
        <Button variant="outline">Enviar contador</Button>
        <Button variant="lime">Gerar relatorio</Button>
      </div>
    </div>
  );
}

