"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Filter,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
  Zap,
  Bot,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getFiscalAutopilotSummary,
  getFiscalAutopilotCategories,
  getFiscalAutopilotIssues,
  applyAutoFix,
  applyConfirmation,
  sendToAccountant,
  getRecentCorrections,
  revalidateAll,
} from "@/lib/services/fiscal/fiscal-autopilot-service";
import type {
  FiscalAutopilotSummary,
  FiscalAutopilotCategory,
  FiscalIssue,
  CorrectionType,
  FiscalIssueStatus,
  RiskLevel,
} from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

type FilterState = {
  type: string;
  status: string;
  riskLevel: string;
  search: string;
};

const TYPE_LABELS: Record<CorrectionType, string> = {
  AUTO_SAFE: "Correcao automatica segura",
  AUTO_CONFIRM: "Precisa confirmacao",
  MANUAL_GUIDED: "Correcao guiada",
  ACCOUNTANT_REVIEW: "Revisao do contador",
  RETRY_ONLY: "Somente reprocessar",
};

const TYPE_COLORS: Record<CorrectionType, string> = {
  AUTO_SAFE: "bg-lime text-ink",
  AUTO_CONFIRM: "bg-blue-50 text-blue-700",
  MANUAL_GUIDED: "bg-muted text-subtle",
  ACCOUNTANT_REVIEW: "bg-purple-50 text-purple-700",
  RETRY_ONLY: "bg-orange-50 text-orange-700",
};

const RISK_COLORS: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<FiscalIssueStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  WAITING_ACCOUNTANT: "Aguardando contador",
  AUTO_FIXED: "Corrigido automaticamente",
  RESOLVED: "Resolvido",
  IGNORED: "Ignorado",
};

const STATUS_COLORS: Record<FiscalIssueStatus, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  WAITING_CLIENT: "bg-yellow-100 text-yellow-700",
  WAITING_ACCOUNTANT: "bg-purple-50 text-purple-700",
  AUTO_FIXED: "bg-lime text-ink",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  IGNORED: "bg-muted text-subtle",
};

const RISK_ORDER: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function FiscalAutopilotView() {
  const [summary, setSummary] = useState<FiscalAutopilotSummary | null>(null);
  const [categories, setCategories] = useState<FiscalAutopilotCategory[]>([]);
  const [issues, setIssues] = useState<FiscalIssue[]>([]);
  const [recentCorrections, setRecentCorrections] = useState<
    Array<{ id: string; action: string; entity: string; timestamp: string; type: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({ type: "", status: "", riskLevel: "", search: "" });
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sum, cats, iss, corr] = await Promise.all([
      getFiscalAutopilotSummary(),
      getFiscalAutopilotCategories(),
      getFiscalAutopilotIssues(),
      getRecentCorrections(),
    ]);
    setSummary(sum);
    setCategories(cats);
    setIssues(iss);
    setRecentCorrections(corr);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredIssues = useMemo(() => {
    let result = issues;
    if (filters.type) result = result.filter(i => i.type === filters.type);
    if (filters.status) result = result.filter(i => i.status === filters.status);
    if (filters.riskLevel) result = result.filter(i => i.riskLevel === filters.riskLevel);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s) || i.code.toLowerCase().includes(s));
    }
    return result.sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 99) - (RISK_ORDER[b.riskLevel] ?? 99));
  }, [issues, filters]);

  const toggleIssue = (id: string) => {
    setSelectedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredIssues.map(i => i.id);
    const allSelected = visibleIds.every(id => selectedIssues.has(id));
    if (allSelected) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(visibleIds));
    }
  };

  const handleAutoFix = async () => {
    const autoSafeIds = [...selectedIssues].filter(id => {
      const issue = issues.find(i => i.id === id);
      return issue?.type === "AUTO_SAFE";
    });
    if (autoSafeIds.length === 0) {
      notify({ title: "Nenhum item elegivel", description: "Selecione itens do tipo Correcao automatica segura", tone: "error" });
      return;
    }
    setActionLoading("autofix");
    const result = await applyAutoFix(autoSafeIds);
    notify({ title: `${result.success} correcoes aplicadas`, description: result.failed > 0 ? `${result.failed} falharam` : "Todas com sucesso", tone: result.failed > 0 ? "error" : "success" });
    setSelectedIssues(new Set());
    await loadData();
    setActionLoading(null);
  };

  const handleConfirm = async () => {
    const confirmIds = [...selectedIssues].filter(id => {
      const issue = issues.find(i => i.id === id);
      return issue?.type === "AUTO_CONFIRM";
    });
    if (confirmIds.length === 0) {
      notify({ title: "Nenhum item elegivel", description: "Selecione itens do tipo Precisa confirmacao", tone: "error" });
      return;
    }
    setActionLoading("confirm");
    const result = await applyConfirmation(confirmIds);
    notify({ title: `${result.success} confirmacoes aplicadas`, description: result.failed > 0 ? `${result.failed} falharam` : "Todas com sucesso", tone: result.failed > 0 ? "error" : "success" });
    setSelectedIssues(new Set());
    await loadData();
    setActionLoading(null);
  };

  const handleSendToAccountant = async () => {
    const accountantIds = [...selectedIssues].filter(id => {
      const issue = issues.find(i => i.id === id);
      return issue?.type === "ACCOUNTANT_REVIEW";
    });
    if (accountantIds.length === 0) {
      notify({ title: "Nenhum item elegivel", description: "Selecione itens do tipo Revisao do contador", tone: "error" });
      return;
    }
    setActionLoading("accountant");
    const result = await sendToAccountant(accountantIds);
    notify({ title: `${result.success} enviados ao contador`, tone: "success" });
    setSelectedIssues(new Set());
    await loadData();
    setActionLoading(null);
  };

  const handleRevalidate = async () => {
    setActionLoading("revalidate");
    const newSummary = await revalidateAll();
    setSummary(newSummary);
    notify({ title: "Revalidacao concluida", tone: "success" });
    await loadData();
    setActionLoading(null);
  };

  if (loading || !summary) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  const openIssues = issues.filter(i => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const criticalCount = openIssues.filter(i => i.riskLevel === "CRITICAL").length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-lime-700">Fiscal Autopilot</p>
            <h1 className="mt-2 text-3xl font-bold text-ink">Centro de Operacoes Fiscal</h1>
            <p className="mt-2 max-w-3xl text-sm text-subtle">
              Analise cadastros, notas, XMLs, estoque, impostos e pendencias. Corrija automaticamente o que for seguro, confirme sugestoes ou encaminhe ao contador.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRevalidate} disabled={actionLoading === "revalidate"}>
              <RefreshCw className={`h-4 w-4 ${actionLoading === "revalidate" ? "animate-spin" : ""}`} />
              Revalidar
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {summary.autoSafeCount > 0 && (
            <Button variant="lime" onClick={handleAutoFix} disabled={actionLoading === "autofix" || selectedIssues.size === 0}>
              <Zap className="h-4 w-4" />
              Corrigir automaticamente ({summary.autoSafeCount})
            </Button>
          )}
          {summary.needsConfirmationCount > 0 && (
            <Button variant="default" onClick={handleConfirm} disabled={actionLoading === "confirm" || selectedIssues.size === 0}>
              <ShieldCheck className="h-4 w-4" />
              Confirmar sugestoes ({summary.needsConfirmationCount})
            </Button>
          )}
          {summary.needsAccountantCount > 0 && (
            <Button variant="outline" onClick={handleSendToAccountant} disabled={actionLoading === "accountant" || selectedIssues.size === 0}>
              <Send className="h-4 w-4" />
              Enviar ao contador ({summary.needsAccountantCount})
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-xs text-subtle">Pendencias criticas</p>
              <p className="text-2xl font-extrabold text-ink">{criticalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-subtle">Total problemas</p>
              <p className="text-2xl font-extrabold text-ink">{summary.totalIssues}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-subtle">Impacto financeiro</p>
              <p className="text-2xl font-extrabold text-ink">{formatCurrency(summary.financialImpact)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-lime-600" />
            <div>
              <p className="text-xs text-subtle">Correcoes aplicadas</p>
              <p className="text-2xl font-extrabold text-ink">{summary.correctionsApplied}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-subtle">Pode corrigir sozinho</p>
          <p className="text-xl font-extrabold text-lime-600">{summary.autoSafeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Precisa confirmacao</p>
          <p className="text-xl font-extrabold text-blue-600">{summary.needsConfirmationCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Precisa contador</p>
          <p className="text-xl font-extrabold text-purple-600">{summary.needsAccountantCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Score Fiscal</p>
          <p className="text-xl font-extrabold text-ink">{summary.fiscalScore}/100</p>
        </Card>
      </div>

      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Problemas ({filteredIssues.length})</TabsTrigger>
          <TabsTrigger value="categories">Categorias ({categories.length})</TabsTrigger>
          <TabsTrigger value="corrections">Correcoes recentes ({recentCorrections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4" /> Filtros
                  <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </Button>
                {(filters.type || filters.status || filters.riskLevel || filters.search) && (
                  <Badge variant="info">{filteredIssues.length} de {issues.length}</Badge>
                )}
              </div>
              {selectedIssues.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-subtle">{selectedIssues.size} selecionados</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIssues(new Set())}>
                    <X className="h-3 w-3" /> Limpar
                  </Button>
                </div>
              )}
            </div>

            {showFilters && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-bold text-subtle mb-1 block">Tipo</label>
                  <select
                    className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
                    value={filters.type}
                    onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle mb-1 block">Status</label>
                  <select
                    className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
                    value={filters.status}
                    onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle mb-1 block">Gravidade</label>
                  <select
                    className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
                    value={filters.riskLevel}
                    onChange={e => setFilters(f => ({ ...f, riskLevel: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    <option value="CRITICAL">Critico</option>
                    <option value="HIGH">Alto</option>
                    <option value="MEDIUM">Medio</option>
                    <option value="LOW">Baixo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle mb-1 block">Buscar</label>
                  <Input
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    placeholder="Titulo, codigo ou descricao..."
                  />
                </div>
              </div>
            )}

            {filteredIssues.length === 0 ? (
              <div className="py-12 text-center text-subtle">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-lime-500" />
                <p className="font-bold">Nenhum problema encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
                  <input
                    type="checkbox"
                    checked={filteredIssues.length > 0 && filteredIssues.every(i => selectedIssues.has(i.id))}
                    onChange={toggleAllVisible}
                    className="rounded"
                  />
                  <span className="text-xs font-bold text-subtle flex-1">Selecionar todos ({filteredIssues.length})</span>
                </div>
                {filteredIssues.map(issue => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    selected={selectedIssues.has(issue.id)}
                    onToggle={() => toggleIssue(issue.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid gap-4 lg:grid-cols-3">
            {categories.map(cat => (
              <Card key={cat.label} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-ink">{cat.label}</h3>
                  <Badge className={TYPE_COLORS[cat.type]}>{cat.count}</Badge>
                </div>
                <ul className="space-y-2">
                  {cat.items.map(item => (
                    <li key={item.id} className="rounded-xl bg-muted px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-subtle">{item.title}</span>
                        <Badge className={RISK_COLORS[item.riskLevel]}>{item.riskLevel}</Badge>
                      </div>
                      <p className="text-xs text-subtle mt-1">{item.description}</p>
                      {item.autoFixAction && (
                        <p className="text-xs text-lime-600 mt-1 font-medium">
                          <Bot className="h-3 w-3 inline" /> {item.autoFixAction}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="corrections">
          <Card className="p-4">
            {recentCorrections.length === 0 ? (
              <div className="py-8 text-center text-subtle">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Nenhuma correcao registrada ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCorrections.map(correction => (
                  <div key={correction.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-line">
                    <div className="flex items-center gap-3">
                      {correction.status === "SUCCESS" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{correction.action}</p>
                        <p className="text-xs text-subtle">{correction.entity}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={correction.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}>
                        {correction.status}
                      </Badge>
                      <p className="text-xs text-subtle mt-1">{formatDate(correction.timestamp, true)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IssueRow({ issue, selected, onToggle }: { issue: FiscalIssue; selected: boolean; onToggle: () => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${selected ? "border-lime-300 bg-lime-50/50" : "border-line bg-white hover:bg-muted"}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="rounded" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold text-ink">{issue.title}</span>
          <Badge className={RISK_COLORS[issue.riskLevel]}>{issue.riskLevel}</Badge>
          <Badge className={TYPE_COLORS[issue.type]}>{TYPE_LABELS[issue.type]}</Badge>
          <Badge className={STATUS_COLORS[issue.status]}>{STATUS_LABELS[issue.status]}</Badge>
        </div>
        <p className="text-xs text-subtle truncate">{issue.description}</p>
        <div className="flex items-center gap-4 mt-1 text-xs text-subtle">
          <span>Codigo: {issue.code}</span>
          {issue.confidence != null && <span>Confianca: {Math.round(issue.confidence * 100)}%</span>}
          {issue.financialImpact > 0 && <span className="text-red-500 font-medium">Impacto: {formatCurrency(issue.financialImpact)}</span>}
          {issue.ruleReference && <span>Regra: {issue.ruleReference}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {issue.autoFixAction && (
          <span className="text-xs text-lime-600 font-medium flex items-center gap-1">
            <Bot className="h-3 w-3" /> {issue.autoFixAction}
          </span>
        )}
      </div>
    </div>
  );
}

export default FiscalAutopilotView;
