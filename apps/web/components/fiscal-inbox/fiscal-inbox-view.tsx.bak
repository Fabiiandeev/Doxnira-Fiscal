"use client";

import { useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, Filter, Inbox, Send, Truck, User, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFiscalInbox, assignToAccountant, requestClient, autoFixInboxItem, ignoreWithJustification, markResolved, bulkAction } from "@/lib/services/fiscal/fiscal-inbox-service";
import type { FiscalInboxItem } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

export function FiscalInboxView() {
  const [items, setItems] = useState<FiscalInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ priority: "", status: "", responsible: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    const data = await getFiscalInbox(filters);
    setItems(data);
    setLoading(false);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(prev => prev.length === items.length ? [] : items.map(i => i.id));

  const handleBulkAction = async (action: any) => {
    const result = await bulkAction(selectedIds, action);
    notify({ title: "Acao em lote", description: `${result.success} processados, ${result.failed} falharam` });
    setSelectedIds([]);
    loadData();
  };

  const priorityColors = { HIGH: "bg-red-50 text-red-700", MEDIUM: "bg-yellow-50 text-yellow-700", LOW: "bg-green-50 text-green-700" };
  const statusColors = { OPEN: "bg-blue-50 text-blue-700", IN_PROGRESS: "bg-yellow-50 text-yellow-700", WAITING_CLIENT: "bg-purple-50 text-purple-700", WAITING_ACCOUNTANT: "bg-orange-50 text-orange-700", AUTO_FIXED: "bg-green-50 text-green-700", RESOLVED: "bg-emerald-50 text-emerald-700", IGNORED: "bg-gray-50 text-gray-700" };
  const typeIcons: Record<string, any> = { XML_NEW: Inbox, NOTE_REJECTED: AlertTriangle, CERTIFICATE_EXPIRING: Zap, GUIDE_DUE: Send, CLIENT_INCOMPLETE: User, PRODUCT_NEW: Truck, CTE_UNLINKED: Truck, ACCOUNTANT_REQUEST: CheckCircle2, CLIENT_RESPONSE: Archive };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Inbox Fiscal</h1><p className="text-sm text-subtle">Central de pendencias com dono e prazo</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm"><Filter className="h-4 w-4" /> Filtros</Button><Button variant="lime" onClick={loadData}><Inbox className="h-4 w-4" /> Atualizar</Button></div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.priority} onChange={e => { setFilters(f => ({ ...f, priority: e.target.value })); loadData(); }} className="h-10 rounded-xl border border-line bg-white px-3"><option value="">Todas prioridades</option><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baixa</option></select>
          <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); loadData(); }} className="h-10 rounded-xl border border-line bg-white px-3"><option value="">Todos status</option><option value="OPEN">Aberta</option><option value="IN_PROGRESS">Em andamento</option><option value="WAITING_CLIENT">Aguardando cliente</option><option value="WAITING_ACCOUNTANT">Aguardando contador</option><option value="RESOLVED">Resolvida</option></select>
          <select value={filters.responsible} onChange={e => { setFilters(f => ({ ...f, responsible: e.target.value })); loadData(); }} className="h-10 rounded-xl border border-line bg-white px-3"><option value="">Todos responsaveis</option><option value="COMPANY">Empresa</option><option value="ACCOUNTANT">Contador</option><option value="SYSTEM">Sistema</option><option value="FISCAL_AI">FiscalAI</option></select>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold">{items.length} itens</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.length === items.length && items.length > 0} onChange={selectAll} className="h-4 w-4 accent-ink" /> Selecionar todos</label>
        </div>

        {loading ? <div className="h-64 animate-pulse rounded-xl bg-white/60" /> : (
          <div className="space-y-2">
            {items.map((item) => (
              <InboxRow key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={toggleSelect} priorityColors={priorityColors} statusColors={statusColors} typeIcons={typeIcons} onAction={handleAction} />
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("assign_accountant")}>Atribuir contador</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("request_client")}>Solicitar cliente</Button>
            <Button variant="lime" size="sm" onClick={() => handleBulkAction("auto_fix")}>Corrigir auto</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction("ignore")}>Ignorar</Button>
            <Button variant="default" size="sm" onClick={() => handleBulkAction("resolve")}>Resolver</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function InboxRow({ item, selected, onSelect, priorityColors, statusColors, typeIcons, onAction }: any) {
  const Icon = typeIcons[item.type] || Inbox;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-line bg-white hover:bg-muted/30 transition">
      <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)} className="mt-1 h-4 w-4 accent-ink" />
      <Icon className="h-5 w-5 text-lime shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{item.problem}</span>
          <Badge className={priorityColors[item.priority]}>{item.priority]}</Badge>
          <Badge className={statusColors[item.status]}>{item.status.replace("_", " ")}</Badge>
          <Badge variant="outline">{item.responsible}</Badge>
        </div>
        <p className="mt-1 text-xs text-subtle">{item.companyName} | Vence: {formatDate(item.dueDate)} | Impacto: {formatCurrency(item.financialImpact)}</p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => onAction("assign_accountant", item.id)}><User className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onAction("request_client", item.id)}><Send className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onAction("auto_fix", item.id)}><Zap className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function handleAction(action: string, itemId: string) {
  // Implementation would call the service functions
}
