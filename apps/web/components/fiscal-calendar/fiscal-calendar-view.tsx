"use client";

import { useState, useEffect } from "react";
import { CreditCard, RefreshCw, Send, Shield, User, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFiscalCalendar, markAsPaid } from "@/lib/services/fiscal/fiscal-calendar-service";
import type { FiscalCalendarItem } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors = { PENDING: "bg-blue-50 text-blue-700", OPEN: "bg-yellow-50 text-yellow-700", DUE_SOON: "bg-orange-50 text-orange-700", PAID: "bg-emerald-50 text-emerald-700", OVERDUE: "bg-red-50 text-red-700", WAITING_ACCOUNTANT: "bg-purple-50 text-purple-700" };

export function FiscalCalendarView() {
  const [items, setItems] = useState<FiscalCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", companyId: "" });

  useEffect(() => {
    const load = async () => { setLoading(true); const data = await getFiscalCalendar(filters); setItems(data); setLoading(false); };
    load();
  }, [filters]);

  const handleAction = async (item: FiscalCalendarItem, action: string) => {
    if (action === "mark_paid") {
      await markAsPaid(item.id);
      notify({ title: "Marcado como pago" });
    } else if (action === "request_guide") {
      notify({ title: "Guia solicitada ao contador" });
    } else if (action === "view_pendency") {
      notify({ title: "Abrindo pendencia" });
    } else if (action === "send_alert") {
      notify({ title: "Alerta enviado" });
    } else if (action === "attach_proof") {
      notify({ title: "Comprovante anexado (mock)" });
    }
    const data = await getFiscalCalendar(filters);
    setItems(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Agenda Fiscal</h1><p className="text-sm text-subtle">Obrigacoes, vencimentos e acoes</p></div>
        <Button variant="lime" onClick={() => { setFilters({ status: "", companyId: "" }); }}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="h-10 rounded-xl border border-line bg-white px-3"><option value="">Todos status</option><option value="PENDING">Pendente</option><option value="OPEN">Em aberto</option><option value="DUE_SOON">Vence em breve</option><option value="PAID">Pago</option><option value="OVERDUE">Atrasado</option><option value="WAITING_ACCOUNTANT">Aguardando contador</option></select>
        </div>
      </Card>

      {loading ? <div className="h-64 animate-pulse rounded-xl bg-white/60" /> : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Obrigacao</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Competencia</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Responsavel</th><th className="px-4 py-3">Acoes</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.obligation}</td>
                  <td className="px-4 py-3">{item.companyName}</td>
                  <td className="px-4 py-3">{item.competence}</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(item.estimatedAmount)}</td>
                  <td className="px-4 py-3">{formatDate(item.dueDate)}</td>
                  <td className="px-4 py-3"><Badge className={statusColors[item.status]}>{item.status}</Badge></td>
                  <td className="px-4 py-3">{item.responsible}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item.actions.includes("MARK_PAID") && <Button variant="default" size="icon" onClick={() => handleAction(item, "mark_paid")} title="Marcar pago"><CreditCard className="h-4 w-4" /></Button>}
                      {item.actions.includes("REQUEST_GUIDE") && <Button variant="outline" size="icon" onClick={() => handleAction(item, "request_guide")} title="Solicitar guia"><Send className="h-4 w-4" /></Button>}
                      {item.actions.includes("ATTACH_PROOF") && <Button variant="outline" size="icon" onClick={() => handleAction(item, "attach_proof")} title="Anexar comprovante"><Shield className="h-4 w-4" /></Button>}
                      {item.actions.includes("VIEW_PENDENCY") && <Button variant="ghost" size="icon" onClick={() => handleAction(item, "view_pendency")} title="Ver pendencia"><User className="h-4 w-4" /></Button>}
                      {item.actions.includes("SEND_ALERT") && <Button variant="ghost" size="icon" onClick={() => handleAction(item, "send_alert")} title="Enviar alerta"><Zap className="h-4 w-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

