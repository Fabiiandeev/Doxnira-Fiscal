"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Send,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAccountantRiskRanking, completeActionPlanItem } from "@/lib/services/fiscal/accountant-service";
import type { AccountantRiskRanking, AccountantRiskCompany, ActionPlanItem, RiskCategory } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  CRITICAL: "Critico",
  HIGH: "Alto",
  MEDIUM: "Medio",
  LOW: "Baixo",
  VERY_LOW: "Muito baixo",
};

const CATEGORY_COLORS: Record<RiskCategory, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
  VERY_LOW: "bg-emerald-100 text-emerald-700",
};

const CATEGORY_ORDER: Record<RiskCategory, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  VERY_LOW: 4,
};

const TREND_ICONS: Record<string, typeof TrendingUp> = {
  IMPROVING: TrendingUp,
  STABLE: ArrowRight,
  WORSENING: TrendingDown,
};

const TREND_COLORS: Record<string, string> = {
  IMPROVING: "text-emerald-500",
  STABLE: "text-subtle",
  WORSENING: "text-red-500",
};

const TREND_LABELS: Record<string, string> = {
  IMPROVING: "Melhorando",
  STABLE: "Estavel",
  WORSENING: "Piorando",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

export function AccountantRiskRankingView() {
  const [data, setData] = useState<AccountantRiskRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getAccountantRiskRanking();
      setData(d);
    } catch {
      setError("Nao foi possivel carregar o ranking de risco. Tente novamente.");
      notify({ title: "Erro ao carregar ranking", tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCompletePlanItem = async (companyId: string, planItemId: string) => {
    try {
      const result = await completeActionPlanItem(companyId, planItemId);
      if (result) {
        setData(result);
        notify({ title: "Acao concluida", tone: "success" });
      }
    } catch {
      notify({ title: "Erro ao concluir acao", tone: "error" });
    }
  };

  if (loading) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Ranking de Risco</h1>
        <Card className="p-6">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" className="mt-4" onClick={loadData}>Tentar novamente</Button>
        </Card>
      </div>
    );
  }
  if (!data) return null;

  const hasCompanies = data.companies.length > 0;

  const sortedCompanies = [...data.companies].sort(
    (a, b) => (CATEGORY_ORDER[a.riskLevel] ?? 99) - (CATEGORY_ORDER[b.riskLevel] ?? 99)
  );

  const filteredCompanies = filterCategory
    ? sortedCompanies.filter(c => c.riskLevel === filterCategory)
    : sortedCompanies;

  const criticalCompanies = data.companies.filter(c => c.riskLevel === "CRITICAL");
  const bestPerforming = data.companies.filter(c => c.riskLevel === "VERY_LOW" || c.riskLevel === "LOW");
  const totalImpact = data.companies.reduce((s, c) => s + c.financialImpact, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Ranking de Risco</h1>
          <p className="text-sm text-subtle">Empresas classificadas por criticidade fiscal</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {!hasCompanies && (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhuma empresa encontrada para calcular ranking de risco</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre empresas ou sincronize dados para gerar o ranking de risco fiscal.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="lime" onClick={() => window.location.href = "/companies"}>Cadastrar empresa</Button>
            <Button variant="outline" onClick={() => window.location.href = "/sync"}>Sincronizar dados</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "VERY_LOW"] as RiskCategory[]).map(cat => {
          const count = cat === "VERY_LOW" ? data.summary.veryLow
            : cat === "LOW" ? data.summary.low
            : cat === "MEDIUM" ? data.summary.medium
            : cat === "HIGH" ? data.summary.high
            : data.summary.critical;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition border ${
                filterCategory === cat ? "border-line ring-2 ring-lime-200" : "border-line hover:border-line"
              }`}
            >
              <Badge className={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</Badge>
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-xs text-subtle">Empresas criticas</p>
              <p className="text-2xl font-extrabold text-red-600">{criticalCompanies.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-subtle">Melhor desempenho</p>
              <p className="text-2xl font-extrabold text-emerald-600">{bestPerforming.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-subtle">Total empresas</p>
              <p className="text-2xl font-extrabold text-ink">{data.companies.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-subtle">Impacto total</p>
              <p className="text-lg font-extrabold text-ink">{formatCurrency(totalImpact)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking">Ranking geral</TabsTrigger>
          <TabsTrigger value="critical">Empresas criticas</TabsTrigger>
          <TabsTrigger value="plans">Planos de acao</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking">
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted text-xs font-bold uppercase text-subtle">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Risco</th>
                  <th className="px-4 py-3 text-center">Tendencia</th>
                  <th className="px-4 py-3 text-left">Principal problema</th>
                  <th className="px-4 py-3 text-right">Impacto</th>
                  <th className="px-4 py-3 text-center">Ultimo evento</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCompanies.map((company, idx) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    rank={idx + 1}
                    expanded={expandedCompany === company.id}
                    onToggle={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                    onCompletePlanItem={handleCompletePlanItem}
                  />
                ))}
              </tbody>
            </table>
            {filteredCompanies.length === 0 && (
              <div className="py-12 text-center text-subtle">
                <Shield className="h-12 w-12 mx-auto mb-3 text-lime-500" />
                <p className="font-bold">Nenhuma empresa nesta categoria</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="critical">
          {criticalCompanies.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-lime-500" />
              <p className="font-bold text-ink">Nenhuma empresa critica</p>
              <p className="text-sm text-subtle">Todas as empresas estao em niveis aceitaveis</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {criticalCompanies.map(company => (
                <Card key={company.id} className="p-5 border-red-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-5 w-5 text-red-500" />
                        <span className="font-bold text-lg text-ink">{company.name}</span>
                        <Badge className={CATEGORY_COLORS[company.riskLevel]}>{CATEGORY_LABELS[company.riskLevel]}</Badge>
                        <Badge className={TREND_COLORS[company.trend] + " bg-muted"}>
                          {(() => { const Icon = TREND_ICONS[company.trend]; return <Icon className="h-3 w-3" />; })()}
                          {TREND_LABELS[company.trend]}
                        </Badge>
                      </div>
                      <p className="text-sm text-red-600 font-medium">{company.mainIssue}</p>
                      <p className="text-sm text-subtle mt-1">Score: {company.score}/100 | Impacto: <span className="text-red-600 font-bold">{formatCurrency(company.financialImpact)}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm">
                        <Zap className="h-3 w-3" /> Agir agora
                      </Button>
                      <Button variant="outline" size="sm">
                        <Send className="h-3 w-3" /> Enviar alerta
                      </Button>
                    </div>
                  </div>

                  {company.actionPlan.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-red-100">
                      <p className="text-xs font-bold text-subtle uppercase mb-2">Plano de acao</p>
                      <div className="space-y-2">
                        {company.actionPlan.map(item => (
                          <ActionPlanRow key={item.id} item={item} onComplete={() => handleCompletePlanItem(company.id, item.id)} />
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans">
          <div className="space-y-4">
            {sortedCompanies.filter(c => c.actionPlan.length > 0).map(company => {
              const completed = company.actionPlan.filter(p => p.completed).length;
              const total = company.actionPlan.length;
              const pct = total > 0 ? (completed / total) * 100 : 100;
              return (
                <Card key={company.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-subtle" />
                      <span className="font-bold text-ink">{company.name}</span>
                      <Badge className={CATEGORY_COLORS[company.riskLevel]}>{CATEGORY_LABELS[company.riskLevel]}</Badge>
                    </div>
                    <span className="text-sm text-subtle">{completed}/{total} concluidos</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? "bg-lime-400" : pct > 50 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {company.actionPlan.map(item => (
                      <ActionPlanRow key={item.id} item={item} onComplete={() => handleCompletePlanItem(company.id, item.id)} />
                    ))}
                  </div>
                </Card>
              );
            })}
            {sortedCompanies.filter(c => c.actionPlan.length > 0).length === 0 && (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-lime-500" />
                <p className="font-bold">Sem planos de acao pendentes</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyRow({
  company,
  rank,
  expanded,
  onToggle,
  onCompletePlanItem,
}: {
  company: AccountantRiskCompany;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onCompletePlanItem: (companyId: string, planItemId: string) => void;
}) {
  const TrendIcon = TREND_ICONS[company.trend] ?? ArrowRight;
  return (
    <>
      <tr className="hover:bg-muted transition cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-sm font-bold text-subtle">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-subtle" />
            <span className="font-medium text-ink">{company.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`font-extrabold text-xl ${company.score < 40 ? "text-red-600" : company.score < 70 ? "text-orange-500" : "text-emerald-600"}`}>
            {company.score}
          </span>
          <span className="text-xs text-subtle">/100</span>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge className={CATEGORY_COLORS[company.riskLevel]}>{CATEGORY_LABELS[company.riskLevel]}</Badge>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <TrendIcon className={`h-4 w-4 ${TREND_COLORS[company.trend]}`} />
            <span className={`text-xs ${TREND_COLORS[company.trend]}`}>{TREND_LABELS[company.trend]}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-red-600">{company.mainIssue}</td>
        <td className="px-4 py-3 text-right font-bold">{formatCurrency(company.financialImpact)}</td>
        <td className="px-4 py-3 text-center text-xs text-subtle">{formatDate(company.lastEventDate)}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex gap-1 justify-end">
            <Button variant={company.riskLevel === "CRITICAL" ? "danger" : company.riskLevel === "HIGH" ? "default" : "outline"} size="sm">
              {company.action}
            </Button>
            <ChevronDown className={`h-4 w-4 text-subtle transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </td>
      </tr>
      {expanded && company.actionPlan.length > 0 && (
        <tr>
          <td colSpan={9} className="px-4 py-3 bg-muted/50">
            <div className="max-w-2xl ml-8">
              <p className="text-xs font-bold text-subtle uppercase mb-2">Plano de acao</p>
              <div className="space-y-2">
                {company.actionPlan.map(item => (
                  <ActionPlanRow key={item.id} item={item} onComplete={() => onCompletePlanItem(company.id, item.id)} />
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionPlanRow({ item, onComplete }: { item: ActionPlanItem; onComplete: () => void }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg ${item.completed ? "bg-emerald-50" : "bg-white border border-line"}`}>
      <button
        type="button"
        onClick={onComplete}
        className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
          item.completed ? "border-emerald-500 bg-emerald-500" : "border-line hover:border-lime-400"
        }`}
      >
        {item.completed && <CheckCircle2 className="h-3 w-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.completed ? "line-through text-subtle" : "text-subtle"}`}>{item.description}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-subtle">
          <Badge className={PRIORITY_COLORS[item.priority]}>{item.priority}</Badge>
          <span>Prazo: {formatDate(item.deadline)}</span>
          <span>Responsavel: {item.responsible}</span>
        </div>
      </div>
      {!item.completed && (
        <Button variant="lime" size="sm" onClick={onComplete}>
          <CheckCircle2 className="h-3 w-3" /> Concluir
        </Button>
      )}
    </div>
  );
}

export default AccountantRiskRankingView;
