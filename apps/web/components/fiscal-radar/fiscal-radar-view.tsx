"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Shield, Target, Zap, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFiscalRadarAlerts, autoFixAlert, applyAISuggestion, sendToAccountant, requestClient } from "@/lib/services/fiscal/fiscal-radar-service";
import type { FiscalRadarAlert } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

export function FiscalRadarView() {
  const [alerts, setAlerts] = useState<FiscalRadarAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await getFiscalRadarAlerts();
    setAlerts(data);
    setLoading(false);
  };

  const categoryColors = { CERTIFICATE: "bg-blue-50 text-blue-700", PRODUCT: "bg-green-50 text-green-700", COMPANY: "bg-purple-50 text-purple-700", DOCUMENT: "bg-orange-50 text-orange-700", SPED: "bg-red-50 text-red-700", TAX: "bg-yellow-50 text-yellow-700" };
  const riskColors = { CRITICAL: "bg-red-50 text-red-700", HIGH: "bg-orange-50 text-orange-700", MEDIUM: "bg-yellow-50 text-yellow-700", LOW: "bg-green-50 text-green-700" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Radar Fiscal</h1><p className="text-sm text-subtle">Alertas preventivos - Antecipa problemas antes que virem multas</p></div>
        <Button variant="lime" onClick={loadData}><Zap className="h-4 w-4" /> Atualizar radar</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><AlertTriangle className="h-6 w-6 text-red-500" /><p className="mt-2 text-sm font-bold">Criticos</p><p className="text-2xl font-extrabold">{alerts.filter(a => a.riskLevel === "CRITICAL").length}</p></Card>
        <Card className="p-4"><AlertTriangle className="h-6 w-6 text-orange-500" /><p className="mt-2 text-sm font-bold">Altos</p><p className="text-2xl font-extrabold">{alerts.filter(a => a.riskLevel === "HIGH").length}</p></Card>
        <Card className="p-4"><AlertTriangle className="h-6 w-6 text-yellow-500" /><p className="mt-2 text-sm font-bold">Medios</p><p className="text-2xl font-extrabold">{alerts.filter(a => a.riskLevel === "MEDIUM").length}</p></Card>
        <Card className="p-4"><CircleDollarSign className="h-6 w-6 text-emerald-500" /><p className="mt-2 text-sm font-bold">Impacto total</p><p className="text-2xl font-extrabold">{formatCurrency(alerts.reduce((s, a) => s + a.estimatedImpact, 0))}</p></Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-extrabold mb-4">Alertas preventivos</h3>
        {loading ? <div className="h-64 animate-pulse rounded-xl bg-white/60" /> : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 rounded-xl border border-line bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-bold">{alert.title}</span>
                      <Badge className={riskColors[alert.riskLevel]}>{alert.riskLevel}</Badge>
                      <Badge className={categoryColors[alert.category]}>{alert.category}</Badge>
                    </div>
                    <p className="text-sm text-subtle">{alert.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtle">
                      <span>Impacto: <span className="font-bold">{formatCurrency(alert.estimatedImpact)}</span></span>
                      {alert.dueDate && <span>Vence: {formatDate(alert.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {alert.actions.includes("AUTO_FIX") && <Button variant="lime" size="sm" onClick={() => autoFixAlert(alert.id)}>Corrigir auto</Button>}
                    {alert.actions.includes("APPLY_AI_SUGGESTION") && <Button variant="default" size="sm" onClick={() => applyAISuggestion(alert.id)}>Aplicar IA</Button>}
                    {alert.actions.includes("REQUEST_CLIENT") && <Button variant="outline" size="sm" onClick={() => requestClient(alert.id)}>Solicitar cliente</Button>}
                    {alert.actions.includes("SEND_TO_ACCOUNTANT") && <Button variant="outline" size="sm" onClick={() => sendToAccountant(alert.id)}>Enviar contador</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

