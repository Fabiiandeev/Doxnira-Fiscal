"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CalendarDays, CircleDollarSign, CreditCard, Download, RefreshCw, Shield, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TaxForecast { period: string; das: number; iss: number; icms: number; pisCofins: number; retentions: number; total: number; dueDate: string; dailyReserve: number; riskLevel: "LOW" | "MEDIUM" | "HIGH"; }

const mockForecast: TaxForecast = {
  period: "Julho/2026",
  das: 8450.00,
  iss: 4200.00,
  icms: 12800.00,
  pisCofins: 3100.00,
  retentions: 2300.00,
  total: 30850.00,
  dueDate: "2026-07-20",
  dailyReserve: 995.00,
  riskLevel: "MEDIUM",
};

export function TaxForecastView() {
  const [forecast, setForecast] = useState<TaxForecast>(mockForecast);
  const [loading, setLoading] = useState(false);

  const riskColors = { LOW: "bg-green-50 text-green-700", MEDIUM: "bg-yellow-50 text-yellow-700", HIGH: "bg-red-50 text-red-700" };

  const handleReserve = (tax: keyof TaxForecast) => {
    notify({ title: `Reserva de ${tax.toUpperCase()} agendada`, description: `R$ ${(forecast as any)[tax].toLocaleString("pt-BR", {minimumFractionDigits: 2})} reservado` });
  };

  const handleMarkPaid = (tax: keyof TaxForecast) => {
    notify({ title: `${tax.toUpperCase()} marcado como pago` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Previsao de Impostos</h1><p className="text-sm text-subtle">Periodo: {forecast.period} | Vencimento: {formatDate(forecast.dueDate)}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => notify({ title: "Previsao atualizada" })}><RefreshCw className="h-4 w-4" /> Atualizar</Button><Button variant="outline"><Download className="h-4 w-4" /> Exportar</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="p-4 text-center"><CircleDollarSign className="h-8 w-8 mx-auto text-red-500" /><p className="mt-2 text-sm font-bold">Total previsto</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.total)}</p></Card>
        <Card className="p-4 text-center"><TrendingUp className="h-8 w-8 mx-auto text-blue-500" /><p className="mt-2 text-sm font-bold">DAS (Simples)</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.das)}</p></Card>
        <Card className="p-4 text-center"><Shield className="h-8 w-8 mx-auto text-purple-500" /><p className="mt-2 text-sm font-bold">ISS</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.iss)}</p></Card>
        <Card className="p-4 text-center"><CircleDollarSign className="h-8 w-8 mx-auto text-green-500" /><p className="mt-2 text-sm font-bold">ICMS</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.icms)}</p></Card>
        <Card className="p-4 text-center"><CreditCard className="h-8 w-8 mx-auto text-orange-500" /><p className="mt-2 text-sm font-bold">PIS/COFINS</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.pisCofins)}</p></Card>
        <Card className="p-4 text-center"><CalendarDays className="h-8 w-8 mx-auto text-lime" /><p className="mt-2 text-sm font-bold">Reserva diaria</p><p className="text-2xl font-extrabold">{formatCurrency(forecast.dailyReserve)}</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Detalhamento por imposto</h3>
          <Badge className={riskColors[forecast.riskLevel]}>Risco de caixa: {forecast.riskLevel}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50 text-xs font-bold uppercase text-subtle"><th className="px-4 py-3">Imposto</th><th className="px-4 py-3">Previsto</th><th className="px-4 py-3">Projecao fim mes</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Acoes</th></tr></thead>
            <tbody className="divide-y divide-line">
              <tr className="hover:bg-muted/30"><td className="px-4 py-3 font-bold">DAS (Simples)</td><td className="px-4 py-3">{formatCurrency(forecast.das)}</td><td className="px-4 py-3">{formatCurrency(forecast.das)}</td><td className="px-4 py-3">{formatDate("2026-07-20")}</td><td className="px-4 py-3"><Badge variant="outline">Pendente</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleReserve("das")}>Reservar</Button><Button variant="default" size="sm" onClick={() => handleMarkPaid("das")}>Pago</Button></div></td></tr>
              <tr className="hover:bg-muted/30"><td className="px-4 py-3">ISS</td><td className="px-4 py-3">{formatCurrency(forecast.iss)}</td><td className="px-4 py-3">{formatCurrency(forecast.iss)}</td><td className="px-4 py-3">{formatDate("2026-07-15")}</td><td className="px-4 py-3"><Badge variant="warning">Vence em breve</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleReserve("iss")}>Reservar</Button><Button variant="default" size="sm" onClick={() => handleMarkPaid("iss")}>Pago</Button></div></td></tr>
              <tr className="hover:bg-muted/30"><td className="px-4 py-3">ICMS</td><td className="px-4 py-3">{formatCurrency(forecast.icms)}</td><td className="px-4 py-3">{formatCurrency(forecast.icms * 1.2)}</td><td className="px-4 py-3">{formatDate("2026-07-10")}</td><td className="px-4 py-3"><Badge variant="outline">Pendente</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleReserve("icms")}>Reservar</Button><Button variant="default" size="sm" onClick={() => handleMarkPaid("icms")}>Pago</Button></div></td></tr>
              <tr className="hover:bg-muted/30"><td className="px-4 py-3">PIS/COFINS</td><td className="px-4 py-3">{formatCurrency(forecast.pisCofins)}</td><td className="px-4 py-3">{formatCurrency(forecast.pisCofins)}</td><td className="px-4 py-3">{formatDate("2026-07-25")}</td><td className="px-4 py-3"><Badge variant="outline">Pendente</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleReserve("pisCofins")}>Reservar</Button><Button variant="default" size="sm" onClick={() => handleMarkPaid("pisCofins")}>Pago</Button></div></td></tr>
              <tr className="hover:bg-muted/30"><td className="px-4 py-3">Retencoes</td><td className="px-4 py-3">{formatCurrency(forecast.retentions)}</td><td className="px-4 py-3">{formatCurrency(forecast.retentions)}</td><td className="px-4 py-3">{formatDate("2026-07-15")}</td><td className="px-4 py-3"><Badge variant="outline">Pendente</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => handleReserve("retentions")}>Reservar</Button><Button variant="default" size="sm" onClick={() => handleMarkPaid("retentions")}>Pago</Button></div></td></tr>
            </tbody>
          </table>
        </Card>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Sugestoes</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3 border-l-4 border-lime"><p className="font-bold">Reserva diaria</p><p className="text-sm text-subtle">Reserve R$ 995,00 por dia ate o vencimento para cobrir todos os impostos.</p></Card>
          <Card className="p-3 border-l-4 border-blue-500"><p className="font-bold">Priorize ISS e ICMS</p><p className="text-sm text-subtle">Vencem antes (dias 10 e 15). Reserve primeiro estes valores.</p></Card>
          <Card className="p-3 border-l-4 border-purple-500"><p className="font-bold">Solicite guias</p><p className="text-sm text-subtle">Peça ao contador as guias de ICMS e ISS com antecedencia de 5 dias.</p></Card>
        </div>
      </Card>
    </div>
  );
}

