
import { fiscalScoreMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalScoreData, FiscalScoreItem, RiskLevel } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-fiscal-score';

function getStored(): FiscalScoreData {
  if (typeof window === 'undefined') return enrichScoreData(fiscalScoreMock);
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return enrichScoreData(JSON.parse(stored)); } catch { /* fall through */ }
  }
  const data = enrichScoreData(fiscalScoreMock);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function setStored(data: FiscalScoreData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

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

function enrichScoreData(base: FiscalScoreData): FiscalScoreData & { factors?: ScoreFactor[] } {
  const { totalPoints } = calculateScoreFromItems(base.items);
  const scaledScore = Math.round(totalPoints * 10);
  const riskLevel = getRiskLevel(scaledScore);
  return {
    ...base,
    score: scaledScore,
    riskLevel,
  };
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
  const variation = Math.floor(Math.random() * 50) - 20;
  const newScore = Math.max(0, Math.min(1000, data.score + variation));
  const riskLevel = getRiskLevel(newScore);

  const updated: FiscalScoreData = {
    ...data,
    score: newScore,
    riskLevel,
    closingScore: Math.max(0, Math.min(100, data.closingScore + Math.floor(Math.random() * 5) - 2)),
  };

  setStored(updated);
  return updated;
}
