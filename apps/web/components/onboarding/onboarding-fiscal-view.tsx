"use client";

import { useState, useEffect } from "react";
import { Building2, CheckCircle2, CircleDollarSign, FileText, RefreshCw, Send, Target, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOnboardingFiscal, completeOnboardingStep, startAIDiagnosis, applySafeCorrections } from "@/lib/services/fiscal/onboarding-fiscal-service";
import type { OnboardingFiscalData } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OnboardingFiscalView() {
  const [data, setData] = useState<OnboardingFiscalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => { setLoading(true); const d = await getOnboardingFiscal(); setData(d); setLoading(false); };
    load();
  }, []);

  if (!data) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Onboarding Fiscal</h1><p className="text-sm text-subtle">Setup completo em 10 minutos - Da importacao ao piloto automatico</p></div>
        <Button variant="lime" onClick={() => loadData()}><Target className="h-4 w-4" /> Reiniciar</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><FileText className="h-6 w-6 text-blue-500" /><p className="mt-2 text-sm font-bold">XMLs importados</p><p className="text-2xl font-extrabold">{data.importedXmls}</p></Card>
        <Card className="p-4"><Zap className="h-6 w-6 text-lime" /><p className="mt-2 text-sm font-bold">Produtos criados</p><p className="text-2xl font-extrabold">{data.createdProducts}</p></Card>
        <Card className="p-4"><Building2 className="h-6 w-6 text-green-500" /><p className="mt-2 text-sm font-bold">Clientes criados</p><p className="text-2xl font-extrabold">{data.createdClients}</p></Card>
        <Card className="p-4"><AlertTriangle className="h-6 w-6 text-orange-500" /><p className="mt-2 text-sm font-bold">Pendencias fiscais</p><p className="text-2xl font-extrabold">{data.fiscalPendencies}</p></Card>
        <Card className="p-4"><Send className="h-6 w-6 text-purple-500" /><p className="mt-2 text-sm font-bold">Sugestoes contador</p><p className="text-2xl font-extrabold">{data.accountantSuggestions}</p></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Passos do Onboarding</h3>
        <div className="space-y-3">
          {data.steps.map((step) => (
            <div key={step.id} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-line">
              <div className={`grid h-10 w-10 place-items-center rounded-full ${step.completed ? "bg-emerald-500 text-white" : "bg-muted text-subtle"}`}>
                {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-bold">{step.id}</span>}
              </div>
              <div className="flex-1">
                <p className="font-bold">{step.title}</p>
                <p className="text-sm text-subtle">{step.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={step.completed ? "success" : "outline"}>{step.completed ? "Concluido" : "Pendente"}</Badge>
                {!step.completed && <Button variant="lime" size="sm" onClick={async () => { const d = await completeOnboardingStep(step.id); setData(d); notify({ title: "Passo concluido" }); }}>Concluir</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Acoes avancadas</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => { const d = await startAIDiagnosis(); setData(d); notify({ title: "Diagnostico iniciado" }); }}>Iniciar diagnostico IA</Button>
          <Button variant="lime" onClick={async () => { const d = await applySafeCorrections(); setData(d); notify({ title: "Correcoes aplicadas" }); }}>Aplicar correcoes seguras</Button>
          <Button variant="outline">Enviar para contador</Button>
          <Button variant="default" onClick={() => notify({ title: "Redirecionando para Dashboard..." })}>Ir para Dashboard</Button>
        </div>
      </Card>
    </div>
  );
}

