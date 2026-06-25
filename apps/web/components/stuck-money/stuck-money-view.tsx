"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CircleDollarSign, CreditCard, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStuckMoney } from "@/lib/services/fiscal/stuck-money-service";
import type { StuckMoneyData } from "@/lib/fiscal-types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function StuckMoneyView() {
  const [data, setData] = useState<StuckMoneyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const d = await getStuckMoney(); setData(d); setLoading(false); };
    load();
  }, []);

  if (!data) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-extrabold">Dinheiro Parado</h1><p className="text-sm text-subtle">Impacto financeiro de pendencias fiscais nao resolvidas</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><CircleDollarSign className="h-8 w-8 text-red-500" /><p className="mt-2 text-sm font-bold">Total parado</p><p className="text-2xl font-extrabold">{formatCurrency(data.totalStuck)}</p></Card>
        <Card className="p-4"><AlertTriangle className="h-8 w-8 text-orange-500" /><p className="mt-2 text-sm font-bold">Categorias</p><p className="text-2xl font-extrabold">{data.byCategory.length}</p></Card>
        <Card className="p-4"><TrendingDown className="h-8 w-8 text-red-500" /><p className="mt-2 text-sm font-bold">Top 3 docs</p><p className="text-2xl font-extrabold">{data.topDocuments.length}</p></Card>
        <Card className="p-4"><TrendingUp className="h-8 w-8 text-emerald-500" /><p className="mt-2 text-sm font-bold">Acoes de recuperacao</p><p className="text-2xl font-extrabold">{data.recoveryActions.length}</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-bold mb-3">Por categoria</h3>
          <div className="space-y-3">
            {data.byCategory.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between p-3 rounded-xl bg-white border border-line">
                <div className="flex items-center gap-3"><span className="font-medium">{cat.label}</span><Badge>{cat.count} docs</Badge></div>
                <div className="text-right"><p className="font-extrabold">{formatCurrency(cat.amount)}</p><p className="text-xs text-subtle">{cat.percentage}% do total</p></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3">Top documentos parados</h3>
          <div className="space-y-3">
            {data.topDocuments.map((doc) => (
              <div key={doc.id} className="p-3 rounded-xl bg-white border border-line">
                <div className="flex items-center justify-between">
                  <div><p className="font-bold text-sm">{doc.issuerName}</p><p className="text-xs text-subtle">{doc.accessKey.slice(-12)}</p></div>
                  <div className="text-right"><p className="font-extrabold">{formatCurrency(doc.amount)}</p><p className="text-xs text-red-500">{doc.daysStuck} dias parado</p></div>
                </div>
                <p className="mt-2 text-xs text-subtle">{doc.reason}</p>
                <Badge variant="outline" className="mt-2">{doc.action}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Acoes de recuperacao</h3>
        <div className="flex flex-wrap gap-2">
          {data.recoveryActions.map((action) => (
            <Button key={action} variant="outline" size="sm">{action}</Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

