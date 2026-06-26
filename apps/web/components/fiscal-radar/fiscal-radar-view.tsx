"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  FileText,
  Filter,
  Package,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getFiscalRadarAlerts,
  autoFixAlert,
  applyAISuggestion,
  sendToAccountant,
  requestClient,
} from "@/lib/services/fiscal/fiscal-radar-service";
import type { FiscalRadarAlert, FiscalRadarAction, RiskLevel } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const RISK_COLORS: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  CRITICAL: "Critico",
  HIGH: "Alto",
  MEDIUM: "Medio",
  LOW: "Baixo",
};

const CATEGORY_COLORS: Record<string, string> = {
  CERTIFICATE: "bg-blue-50 text-blue-700",
  PRODUCT: "bg-green-50 text-green-700",
  COMPANY: "bg-purple-50 text-purple-700",
  DOCUMENT: "bg-orange-50 text-orange-700",
  SPED: "bg-red-50 text-red-700",
  TAX: "bg-yellow-50 text-yellow-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  CERTIFICATE: "Certificado",
  PRODUCT: "Produto",
  COMPANY: "Empresa",
  DOCUMENT: "Documento",
  SPED: "SPED",
  TAX: "Imposto",
};

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  CERTIFICATE: Shield,
  PRODUCT: Package,
  COMPANY: Activity,
  DOCUMENT: FileText,
  SPED: FileText,
  TAX: CircleDollarSign,
};

type TimelineEvent = {
  id: string;
  type: "ALERT_CREATED" | "ALERT_FIXED" | "AI_APPLIED" | "SENT_ACCOUNTANT" | "CLIENT_REQUESTED";
  description: string;
  timestamp: string;
  riskLevel: RiskLevel;
};

type FilterState = {
  riskLevel: string;
  category: string;
  search: string;
};

export function FiscalRadarView() {
  const [alerts, setAlerts] = useState<FiscalRadarAlert[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterState>({ riskLevel: "", category: "", search: "" });
  const [showFilters, setShowFilters] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    const data = await getFiscalRadarAlerts();
    setAlerts(data);
    setTimeline(buildTimeline(data));
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { loadData(); }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadData]);

  const filteredAlerts = (() => {
    let result = alerts;
    if (filters.riskLevel) result = result.filter(a => a.riskLevel === filters.riskLevel);
    if (filters.category) result = result.filter(a => a.category === filters.category);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s));
    }
    return result;
  })();

  const handleAutoFix = async (alertId: string) => {
    await autoFixAlert(alertId);
    notify({ title: "Alerta corrigido automaticamente", tone: "success" });
    await loadData();
  };

  const handleApplyAI = async (alertId: string) => {
    await applyAISuggestion(alertId);
    notify({ title: "Sugestao da IA aplicada", tone: "success" });
    await loadData();
  };

  const handleSendAccountant = async (alertId: string) => {
    await sendToAccountant(alertId);
    notify({ title: "Enviado ao contador", tone: "success" });
    await loadData();
  };

  const handleRequestClient = async (alertId: string) => {
    await requestClient(alertId);
    notify({ title: "Solicitacao enviada ao cliente", tone: "success" });
    await loadData();
  };

  const handleAction = async (action: FiscalRadarAction, alertId: string) => {
    switch (action) {
      case "AUTO_FIX": return handleAutoFix(alertId);
      case "APPLY_AI_SUGGESTION": return handleApplyAI(alertId);
      case "SEND_TO_ACCOUNTANT": return handleSendAccountant(alertId);
      case "REQUEST_CLIENT": return handleRequestClient(alertId);
    }
  };

  const criticalCount = alerts.filter(a => a.riskLevel === "CRITICAL").length;
  const highCount = alerts.filter(a => a.riskLevel === "HIGH").length;
  const mediumCount = alerts.filter(a => a.riskLevel === "MEDIUM").length;
  const totalImpact = alerts.reduce((sum, a) => sum + a.estimatedImpact, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Radar Fiscal</h1>
          <p className="text-sm text-subtle">
            Monitor em tempo real - Antecipa problemas antes que virem multas
            {lastRefresh && <span className="ml-2 text-subtle">Atualizado: {lastRefresh.toLocaleTimeString("pt-BR")}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "lime" : "outline"}
            size="sm"
            onClick={() => { setAutoRefresh(!autoRefresh); notify({ title: autoRefresh ? "Auto-refresh desativado" : "Auto-refresh a cada 30s", tone: "info" }); }}
          >
            <RefreshCw className="h-4 w-4" />
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </Button>
          <Button variant="lime" onClick={async () => { setLoading(true); await loadData(); notify({ title: "Radar atualizado", tone: "success" }); }}>
            <Zap className="h-4 w-4" /> Atualizar radar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-7 w-7 text-red-500" />
            <div>
              <p className="text-xs text-subtle">Criticos</p>
              <p className="text-2xl font-extrabold text-red-600">{criticalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-orange-500" />
            <div>
              <p className="text-xs text-subtle">Altos</p>
              <p className="text-2xl font-extrabold text-orange-600">{highCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
            <div>
              <p className="text-xs text-subtle">Medios</p>
              <p className="text-2xl font-extrabold text-yellow-600">{mediumCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-7 w-7 text-emerald-500" />
            <div>
              <p className="text-xs text-subtle">Impacto total</p>
              <p className="text-lg font-extrabold text-ink">{formatCurrency(totalImpact)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Bell className="h-7 w-7 text-blue-500" />
            <div>
              <p className="text-xs text-subtle">Total alertas</p>
              <p className="text-2xl font-extrabold text-ink">{alerts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">
            <Activity className="h-3 w-3" /> Alertas ({filteredAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-3 w-3" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="by-category">
            <Filter className="h-3 w-3" /> Por categoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4" /> Filtros
                <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </Button>
              {(filters.riskLevel || filters.category || filters.search) && (
                <div className="flex gap-1 items-center">
                  <Badge variant="info">{filteredAlerts.length} de {alerts.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ riskLevel: "", category: "", search: "" })}>
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {showFilters && (
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
                  <label className="text-xs font-bold text-subtle mb-1 block">Categoria</label>
                  <select
                    className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
                    value={filters.category}
                    onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-subtle mb-1 block">Buscar</label>
                  <Input
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    placeholder="Titulo ou descricao..."
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-white/60" />
            ) : filteredAlerts.length === 0 ? (
              <div className="py-12 text-center text-subtle">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-lime-500" />
                <p className="font-bold">Nenhum alerta encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(alert => {
                  const CategoryIcon = CATEGORY_ICONS[alert.category] ?? FileText;
                  return (
                    <div key={alert.id} className="p-4 rounded-xl border border-line bg-white hover:border-ink/20 transition">
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[alert.category]}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-ink">{alert.title}</span>
                            <Badge className={RISK_COLORS[alert.riskLevel]}>{RISK_LABELS[alert.riskLevel]}</Badge>
                            <Badge className={CATEGORY_COLORS[alert.category]}>{CATEGORY_LABELS[alert.category]}</Badge>
                          </div>
                          <p className="text-sm text-subtle">{alert.description}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-subtle">
                            <span>Impacto: <span className="font-bold text-red-500">{formatCurrency(alert.estimatedImpact)}</span></span>
                            {alert.dueDate && <span>Vence: <span className="font-bold">{formatDate(alert.dueDate)}</span></span>}
                            <span>Criado: {formatDate(alert.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {alert.actions.map(action => (
                            <ActionButton key={action} action={action} onAction={() => handleAction(action, alert.id)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-4">Linha do tempo de eventos</h3>
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-line" />
              {timeline.map((event) => (
                <div key={event.id} className="relative mb-6 last:mb-0">
                  <div className={`absolute -left-3.5 top-1 h-4 w-4 rounded-full border-2 border-white ${getEventDotColor(event.type)}`} />
                  <div className="ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-subtle">{formatDate(event.timestamp, true)}</span>
                      <Badge className={`text-[9px] ${RISK_COLORS[event.riskLevel]}`}>{RISK_LABELS[event.riskLevel]}</Badge>
                    </div>
                    <p className="text-sm text-ink">{event.description}</p>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <div className="py-8 text-center text-subtle">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Nenhum evento registrado</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="by-category">
          <div className="grid gap-4 lg:grid-cols-3">
            {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
              const catAlerts = alerts.filter(a => a.category === catKey);
              const CategoryIcon = CATEGORY_ICONS[catKey] ?? FileText;
              return (
                <Card key={catKey} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-5 w-5 text-subtle" />
                      <h3 className="font-bold text-ink">{catLabel}</h3>
                    </div>
                    <Badge className={CATEGORY_COLORS[catKey]}>{catAlerts.length}</Badge>
                  </div>
                  {catAlerts.length === 0 ? (
                    <p className="text-xs text-subtle">Nenhum alerta</p>
                  ) : (
                    <ul className="space-y-2">
                      {catAlerts.map(alert => (
                        <li key={alert.id} className="p-3 rounded-xl bg-muted border border-line">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-ink">{alert.title}</span>
                            <Badge className={RISK_COLORS[alert.riskLevel]}>{RISK_LABELS[alert.riskLevel]}</Badge>
                          </div>
                          <p className="text-xs text-subtle">{alert.description}</p>
                          <p className="text-xs text-red-500 font-medium mt-1">Impacto: {formatCurrency(alert.estimatedImpact)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionButton({ action, onAction }: { action: FiscalRadarAction; onAction: () => void }) {
  const config: Record<FiscalRadarAction, { label: string; variant: "lime" | "default" | "outline" | "ghost" }> = {
    AUTO_FIX: { label: "Corrigir auto", variant: "lime" },
    APPLY_AI_SUGGESTION: { label: "Aplicar IA", variant: "default" },
    REQUEST_CLIENT: { label: "Solicitar cliente", variant: "outline" },
    SEND_TO_ACCOUNTANT: { label: "Enviar contador", variant: "outline" },
  };
  const { label, variant } = config[action];
  return (
    <Button variant={variant} size="sm" onClick={onAction}>
      {label}
    </Button>
  );
}

function getEventDotColor(type: TimelineEvent["type"]): string {
  switch (type) {
    case "ALERT_CREATED": return "bg-red-400";
    case "ALERT_FIXED": return "bg-emerald-400";
    case "AI_APPLIED": return "bg-lime-400";
    case "SENT_ACCOUNTANT": return "bg-purple-400";
    case "CLIENT_REQUESTED": return "bg-blue-400";
  }
}

function buildTimeline(alerts: FiscalRadarAlert[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const alert of alerts) {
    events.push({
      id: `tl-${alert.id}-created`,
      type: "ALERT_CREATED",
      description: `Alerta criado: ${alert.title}`,
      timestamp: alert.createdAt,
      riskLevel: alert.riskLevel,
    });
  }
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export default FiscalRadarView;
