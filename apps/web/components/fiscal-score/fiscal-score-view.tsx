"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  RefreshCw,
  Send,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFiscalScore, getScoreFactors, recalculateScore } from "@/lib/services/fiscal/fiscal-score-service";
import type { FiscalScoreData, RiskLevel } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";

type ScoreFactor = {
  id: string;
  label: string;
  weight: number;
  maxPoints: number;
  earnedPoints: number;
  status: "OK" | "WARNING" | "ERROR";
  details: string;
  reason?: string;
};

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Medio",
  HIGH: "Alto",
  CRITICAL: "Critico",
};

const RISK_RING_COLORS: Record<RiskLevel, string> = {
  LOW: "stroke-emerald-500",
  MEDIUM: "stroke-yellow-500",
  HIGH: "stroke-orange-500",
  CRITICAL: "stroke-red-500",
};

const STATUS_COLORS: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700",
  WARNING: "bg-yellow-50 text-yellow-700",
  ERROR: "bg-red-50 text-red-700",
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  OK: CheckCircle2,
  WARNING: AlertTriangle,
  ERROR: XCircle,
};

export function FiscalScoreView() {
  const [scoreData, setScoreData] = useState<FiscalScoreData | null>(null);
  const [factors, setFactors] = useState<ScoreFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [data, facs] = await Promise.all([getFiscalScore(), getScoreFactors()]);
    setScoreData(data);
    setFactors(facs);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    const data = await recalculateScore();
    const facs = await getScoreFactors();
    setScoreData(data);
    setFactors(facs);
    setRecalculating(false);
    notify({ title: "Score recalculado", description: `Novo score: ${data.score}/1000`, tone: "success" });
  };

  if (loading || !scoreData) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  const scorePercentage = scoreData.score / 1000;
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference * (1 - scorePercentage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Score Fiscal</h1>
          <p className="text-sm text-slate-500">Saude fiscal da empresa - {scoreData.closingPeriod}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} /> Recalcular
          </Button>
          <Button variant="lime">
            <Zap className="h-4 w-4" /> Corrigir problemas
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 flex flex-col items-center justify-center">
          <div className="relative h-36 w-36">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" className="stroke-slate-100" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                className={RISK_RING_COLORS[scoreData.riskLevel]}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-slate-950">{scoreData.score}</span>
              <span className="text-xs text-slate-400">/1000</span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <Badge className={`mt-2 ${RISK_COLORS[scoreData.riskLevel]}`}>{RISK_LABELS[scoreData.riskLevel]}</Badge>
            <p className="text-xs text-slate-400 mt-1">Score Fiscal</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-lime-500" />
              <div>
                <p className="text-xs text-slate-400">Score Fechamento</p>
                <p className="text-2xl font-extrabold">{scoreData.closingScore}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xs text-slate-400">Periodo</p>
                <p className="text-2xl font-extrabold">{scoreData.closingPeriod}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-xs text-slate-400">Correcoes aplicadas</p>
                <p className="text-2xl font-extrabold">{factors.filter(f => f.status === "OK").length}/{factors.length}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Evolucao</h3>
          <div className="space-y-2">
            {scoreData.evolution.map((e, idx) => {
              const scaledScore = e.score * 10;
              const pct = scaledScore / 1000;
              const prevScore = idx > 0 ? scoreData.evolution[idx - 1].score * 10 : 0;
              const diff = scaledScore - prevScore;
              return (
                <div key={e.period} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 w-14">{e.period}</span>
                  <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lime-400 transition-all duration-500"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-14 text-right">{scaledScore}/1000</span>
                  {idx > 0 && (
                    <span className={`text-[10px] font-bold ${diff >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {diff >= 0 ? "+" : ""}{diff}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="factors">
        <TabsList>
          <TabsTrigger value="factors">Fatores do Score</TabsTrigger>
          <TabsTrigger value="details">Detalhes & Acoes</TabsTrigger>
        </TabsList>

        <TabsContent value="factors">
          <Card className="p-4">
            <h3 className="font-bold mb-4">Fatores do Score ({factors.length})</h3>
            <div className="space-y-3">
              {factors.map(factor => {
                const StatusIcon = STATUS_ICONS[factor.status] ?? AlertTriangle;
                const isExpanded = expandedFactor === factor.id;
                return (
                  <div key={factor.id} className="rounded-xl border border-slate-100 bg-white overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition"
                      onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}
                    >
                      <StatusIcon className={`h-5 w-5 shrink-0 ${factor.status === "OK" ? "text-emerald-500" : factor.status === "WARNING" ? "text-yellow-500" : "text-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-950">{factor.label}</span>
                          <div className="flex items-center gap-2">
                            <Badge className={STATUS_COLORS[factor.status]}>{factor.status}</Badge>
                            <span className="text-xs text-slate-400">Peso: {factor.weight}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${factor.status === "OK" ? "bg-emerald-400" : factor.status === "WARNING" ? "bg-yellow-400" : "bg-red-400"}`}
                              style={{ width: `${(factor.earnedPoints / factor.maxPoints) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-500 w-20 text-right">{factor.earnedPoints}/{factor.maxPoints} pts</span>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-50 pt-3">
                        <p className="text-sm text-slate-600">{factor.details}</p>
                        {factor.reason && (
                          <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-xs text-red-700 font-medium">{factor.reason}</p>
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          {factor.status === "ERROR" && (
                            <Button variant="danger" size="sm"><Zap className="h-3 w-3" /> Corrigir agora</Button>
                          )}
                          {factor.status === "WARNING" && (
                            <Button variant="outline" size="sm"><RefreshCw className="h-3 w-3" /> Revisar</Button>
                          )}
                          {factor.status === "OK" && (
                            <Button variant="ghost" size="sm"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Concluido</Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-bold text-emerald-600 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Pontos positivos
              </h3>
              <ul className="space-y-2 text-sm">
                {scoreData.positivePoints.map(p => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-bold text-yellow-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Riscos
              </h3>
              <ul className="space-y-2 text-sm">
                {scoreData.risks.map(r => (
                  <li key={r} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Pendencias criticas
              </h3>
              <ul className="space-y-2 text-sm">
                {scoreData.criticalPendencies.map(p => (
                  <li key={p} className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-bold text-blue-600 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Acoes recomendadas
              </h3>
              <ul className="space-y-2 text-sm">
                {scoreData.recommendedActions.map(a => (
                  <li key={a} className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline"><Send className="h-4 w-4" /> Enviar ao contador</Button>
            <Button variant="lime"><FileText className="h-4 w-4" /> Gerar relatorio</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FiscalScoreView;
