"use client";

import { useState, useEffect } from "react";
import { Building2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccountantWorkQueue, updateWorkQueueItem, moveWorkQueueItem } from "@/lib/services/fiscal/accountant-service";
import type { AccountantWorkQueueItem } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

const columnOrder = ["CRITICAL", "HIGH", "MEDIUM", "RESOLVED"] as const;
type ColumnKey = typeof columnOrder[number];
const columnColors: Record<ColumnKey, string> = { CRITICAL: "bg-red-50 border-red-200", HIGH: "bg-orange-50 border-orange-200", MEDIUM: "bg-yellow-50 border-yellow-200", RESOLVED: "bg-green-50 border-green-200" };

export function AccountantWorkQueueView() {
  const [items, setItems] = useState<AccountantWorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const data = await getAccountantWorkQueue(); setItems(data); setLoading(false); };
    load();
  }, []);

  const handleMove = async (id: string, newColumn: ColumnKey) => {
    await moveWorkQueueItem(id, newColumn);
    notify({ title: "Movido para " + newColumn });
    const data = await getAccountantWorkQueue();
    setItems(data);
  };

  const handleAction = async (item: AccountantWorkQueueItem, action: string) => {
    if (action === "assign_accountant") await updateWorkQueueItem(item.id, { responsible: "ACCOUNTANT" });
    if (action === "request_client") await updateWorkQueueItem(item.id, { responsible: "COMPANY" });
    if (action === "auto_fix") await updateWorkQueueItem(item.id, { status: "AUTO_FIXED" });
    if (action === "ignore") await updateWorkQueueItem(item.id, { status: "IGNORED" });
    if (action === "mark_resolved") await updateWorkQueueItem(item.id, { status: "RESOLVED", column: "RESOLVED" });
    notify({ title: "Acao: " + action });
    const data = await getAccountantWorkQueue();
    setItems(data);
  };

  if (loading) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-extrabold">Fila Fiscal do Contador</h1><p className="text-sm text-subtle">Kanban de demandas fiscais por criticidade</p></div>

      <div className="grid gap-4 lg:grid-cols-4">
        {columnOrder.map((column) => (
          <Card key={column} className={`${columnColors[column]} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold capitalize">{column.toLowerCase()}</h3>
              <Badge>{items.filter(i => i.column === column).length}</Badge>
            </div>
            <div className="space-y-2 min-h-[400px]">
              {items.filter(i => i.column === column).map((item) => (
                <WorkQueueCard key={item.id} item={item} onAction={handleAction} onMove={handleMove} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkQueueCard({ item, onAction, onMove }: { item: AccountantWorkQueueItem; onAction: (item: AccountantWorkQueueItem, action: string) => void; onMove: (id: string, column: ColumnKey) => void }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-line shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <Building2 className="h-4 w-4 text-lime" />
        <Badge variant="outline">{item.column}</Badge>
      </div>
      <p className="font-bold text-sm mb-1">{item.companyName}</p>
      <p className="text-xs text-red-500 mb-2">{item.problem}</p>
      <div className="flex flex-wrap gap-2 text-xs text-subtle mb-2">
        <span>Impacto: <span className="font-bold">{formatCurrency(item.financialImpact)}</span></span>
        <span>Prazo: {formatDate(item.dueDate)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {item.actions.includes("ASSIGN_ACCOUNTANT") && <Button variant="outline" size="sm" onClick={() => onAction(item, "assign_accountant")}>Atribuir</Button>}
        {item.actions.includes("REQUEST_CLIENT") && <Button variant="outline" size="sm" onClick={() => onAction(item, "request_client")}>Cliente</Button>}
        {item.actions.includes("AUTO_FIX") && <Button variant="lime" size="sm" onClick={() => onAction(item, "auto_fix")}>Auto</Button>}
        {item.actions.includes("IGNORE") && <Button variant="ghost" size="sm" onClick={() => onAction(item, "ignore")}>Ignorar</Button>}
        {item.actions.includes("MARK_RESOLVED") && <Button variant="default" size="sm" onClick={() => onAction(item, "mark_resolved")}>Resolver</Button>}
      </div>
      <div className="mt-2 flex gap-1">
        {columnOrder.filter(c => c !== item.column).map(col => (
          <Button key={col} variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(item.id, col)} title="Mover para {col}"><Clock className="h-3.5 w-3.5" /></Button>
        ))}
      </div>
    </div>
  );
}

