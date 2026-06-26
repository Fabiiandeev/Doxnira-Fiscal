"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFiscalMaturity, completeRequirement, advanceLevel } from "@/lib/services/fiscal/fiscal-maturity-service";
import type { FiscalMaturityData } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";

const levelNames: Record<string, string> = {
  "LEVEL_1_MESSY": "Nivel 1 - Baguncado",
  "LEVEL_2_DOCUMENTS_ORGANIZED": "Nivel 2 - Documentos Organizados",
  "LEVEL_3_REGISTRATIONS_VALIDATED": "Nivel 3 - Cadastros Validados",
  "LEVEL_4_FISCAL_STOCK_CONTROLLED": "Nivel 4 - Estoque Fiscal Controlado",
  "LEVEL_5_AUTO_CLOSING": "Nivel 5 - Fechamento Automatico",
  "LEVEL_6_FISCAL_AUTOPILOT": "Nivel 6 - Fiscal Autopilot",
};

export function FiscalMaturityView() {
  const [data, setData] = useState<FiscalMaturityData | null>(null);

  useEffect(() => {
    const load = async () => { const d = await getFiscalMaturity(); setData(d); };
    load();
  }, []);

  if (!data) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  const allLevels = ["LEVEL_1_MESSY", "LEVEL_2_DOCUMENTS_ORGANIZED", "LEVEL_3_REGISTRATIONS_VALIDATED", "LEVEL_4_FISCAL_STOCK_CONTROLLED", "LEVEL_5_AUTO_CLOSING", "LEVEL_6_FISCAL_AUTOPILOT"];
  const currentIndex = allLevels.indexOf(data.currentLevel);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Maturidade Fiscal</h1><p className="text-sm text-subtle">Evolucao da gestao fiscal da empresa</p></div>
        <div className="flex gap-2"><Button variant="lime" onClick={async () => { const d = await advanceLevel(); setData(d); notify({ title: "Nivel avancado!" }); }}>Avancar nivel</Button><Button variant="outline" onClick={async () => { const d = await getFiscalMaturity(); setData(d); }}>Atualizar</Button></div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-3xl font-extrabold">{levelNames[data.currentLevel]}</p>
            <p className="text-sm text-subtle">Progresso: {data.progress}%</p>
          </div>
          <div className="w-48 h-48 relative">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="#E1E1DC" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="45" stroke="#E8FF5A" strokeWidth="8" fill="none" strokeDasharray={`${data.progress * 2.83} 283`} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 0.5s" }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl font-extrabold">{data.progress}%</span></div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto mb-4">
          {allLevels.map((level, idx) => (
            <Card key={level} className={`px-4 py-2 min-w-[140px] text-center ${idx === currentIndex ? "bg-lime text-ink" : idx < currentIndex ? "bg-emerald-50 text-emerald-700" : "bg-muted/50 text-subtle"}`}>
              <p className="font-bold text-xs">{levelNames[level]}</p>
              <p className="text-xs">{idx < currentIndex ? "? Concluido" : idx === currentIndex ? "?? Atual" : "?? Bloqueado"}</p>
            </Card>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-bold mb-3">Requisitos</h3>
          <div className="space-y-3">
            {data.requirements.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-line">
                <CheckCircle2 className={`h-5 w-5 ${req.completed ? "text-emerald-500" : "text-subtle"}`} />
                <span className="flex-1">{req.description}</span>
                <Badge variant="outline">{levelNames[req.level]}</Badge>
                {!req.completed && <Button variant="lime" size="sm" onClick={async () => { const d = await completeRequirement(req.id); setData(d); notify({ title: "Requisito concluido" }); }}>Concluir</Button>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3">Para chegar no proximo nivel</h3>
          {data.nextLevelRequirements.length > 0 ? (
            <ul className="space-y-2">
              {data.nextLevelRequirements.map((r, i) => (
                <li key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-line"><TrendingUp className="h-4 w-4 text-lime" />{r}</li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-subtle">
              <TrendingUp className="h-12 w-12 mx-auto text-lime mb-2" />
              <p>Voce atingiu o nivel maximo: Fiscal Autopilot!</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

