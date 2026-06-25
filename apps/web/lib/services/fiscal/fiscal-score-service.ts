
import { fiscalScoreMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalScoreData } from '@/lib/fiscal-types';

export async function getFiscalScore(): Promise<FiscalScoreData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return fiscalScoreMock;
}

export async function recalculateScore(): Promise<FiscalScoreData> {
  await new Promise(resolve => setTimeout(resolve, 500));
  // Simulate recalculation with small variations
  return {
    ...fiscalScoreMock,
    score: Math.max(0, Math.min(100, fiscalScoreMock.score + Math.floor(Math.random() * 5) - 2)),
    closingScore: Math.max(0, Math.min(100, fiscalScoreMock.closingScore + Math.floor(Math.random() * 5) - 2)),
  };
}

