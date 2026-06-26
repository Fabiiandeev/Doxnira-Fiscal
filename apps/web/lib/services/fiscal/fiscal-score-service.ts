import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { FiscalScoreData, FiscalScoreItem, RiskLevel } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-fiscal-score";

type ScoreFactor = {
  id: string;
  label: string;
  weight: number;
  maxPoints: number;
  earnedPoints: number;
  status: "OK" | "WARNING" | "ERROR";
  details: string;
  reason?: string;
};

const emptyScoreData: FiscalScoreData = {
  score: 0,
  riskLevel: "CRITICAL",
  closingScore: 0,
  closingPeriod: "",
  items: [
    { id: "sc-1", label: "Empresa configurada", status: "ERROR", weight: 20, details: "Configure os dados da empresa" },
    { id: "sc-2", label: "Certificado digital", status: "ERROR", weight: 20, details: "Cadastre um certificado digital A1" },
    { id: "sc-3", label: "Clientes cadastrados", status: "ERROR", weight: 15, details: "Cadastre clientes para iniciar" },
    { id: "sc-4", label: "Produtos classificados", status: "ERROR", weight: 15, details: "Cadastre produtos com NCM" },
    { id: "sc-5", label: "Documentos fiscais", status: "ERROR", weight: 20, details: "Importe XMLs de documentos fiscais" },
    { id: "sc-6", label: "Fechamento fiscal", status: "ERROR", weight: 10, details: "Realize o fechamento fiscal" },
  ],
  evolution: [],
  positivePoints: [],
  risks: ["Nenhum dado fiscal configurado"],
  criticalPendencies: [
    "Configurar dados da empresa",
    "Cadastrar certificado digital",
    "Cadastrar clientes",
    "Classificar produtos com NCM",
    "Importar documentos fiscais (XMLs)",
    "Realizar fechamento fiscal",
  ],
  recommendedActions: [
    "Cadastre ou selecione uma empresa",
    "Importe um certificado digital A1",
    "Importe XMLs de notas fiscais",
    "Cadastre produtos e clientes",
  ],
};

function getStored(): FiscalScoreData {
  return safeParseStorage<FiscalScoreData>(STORAGE_KEY, emptyScoreData);
}

function setStored(data: FiscalScoreData) {
  setStorage(STORAGE_KEY, data);
}

function calculateScoreFromItems(items: FiscalScoreItem[]): { totalPoints: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = items.map(item => {
    const maxPoints = item.weight * 10;
    let earnedPoints: number;
    if (item.status === "OK") earnedPoints = maxPoints;
    else if (item.status === "WARNING") earnedPoints = Math.round(maxPoints * 0.6);
    else earnedPoints = Math.round(maxPoints * 0.2);

    return {
      id: item.id,
      label: item.label,
      weight: item.weight,
      maxPoints,
      earnedPoints,
      status: item.status,
      details: item.details ?? "",
      reason: item.status === "ERROR" ? "Correcao urgente necessaria" : item.status === "WARNING" ? "Atencao recomendada" : undefined,
    };
  });

  const totalPoints = factors.reduce((sum, f) => sum + f.earnedPoints, 0);
  return { totalPoints, factors };
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 800) return "LOW";
  if (score >= 600) return "MEDIUM";
  if (score >= 400) return "HIGH";
  return "CRITICAL";
}

export async function getFiscalScore(): Promise<FiscalScoreData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return getStored();
}

export async function getScoreFactors(): Promise<ScoreFactor[]> {
  const storedData = getStored();
  const { factors } = calculateScoreFromItems(storedData.items);
  return factors;
}

export async function recalculateScore(): Promise<FiscalScoreData> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const data = getStored();
  const { totalPoints } = calculateScoreFromItems(data.items);
  const newScore = Math.round(totalPoints * 10);
  const riskLevel = getRiskLevel(newScore);

  const updated: FiscalScoreData = {
    ...data,
    score: newScore,
    riskLevel,
    closingScore: Math.max(0, Math.min(100, Math.round(totalPoints / 10))),
  };

  setStored(updated);
  return updated;
}
