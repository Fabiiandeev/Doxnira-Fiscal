
import { fiscalMaturityMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalMaturityData } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-fiscal-maturity';

function getStored(): FiscalMaturityData {
  if (typeof window === 'undefined') return fiscalMaturityMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalMaturityMock));
  return fiscalMaturityMock;
}

function setStored(data: FiscalMaturityData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getFiscalMaturity(): Promise<FiscalMaturityData> {
  await new Promise(res => setTimeout(res, 200));
  return getStored();
}

export async function completeRequirement(requirementId: string): Promise<FiscalMaturityData> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const req = data.requirements.find(r => r.id === requirementId);
  if (req) {
    req.completed = true;
    // Recalculate progress
    const total = data.requirements.length;
    const completed = data.requirements.filter(r => r.completed).length;
    data.progress = Math.round((completed / total) * 100);
    
    // Check for level up
    const levels = ['LEVEL_1_MESSY', 'LEVEL_2_DOCUMENTS_ORGANIZED', 'LEVEL_3_REGISTRATIONS_VALIDATED', 'LEVEL_4_FISCAL_STOCK_CONTROLLED', 'LEVEL_5_AUTO_CLOSING', 'LEVEL_6_FISCAL_AUTOPILOT'];
    const currentIndex = levels.indexOf(data.currentLevel);
    const nextLevelRequirements = data.requirements.filter(r => r.level === levels[currentIndex + 1] && !r.completed);
    if (nextLevelRequirements.length === 0 && currentIndex < levels.length - 1) {
      data.currentLevel = levels[currentIndex + 1] as any;
      data.levelName = getLevelName(data.currentLevel);
    }
    
    setStored(data);
  }
  return data;
}

export async function advanceLevel(): Promise<FiscalMaturityData> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const levels = ['LEVEL_1_MESSY', 'LEVEL_2_DOCUMENTS_ORGANIZED', 'LEVEL_3_REGISTRATIONS_VALIDATED', 'LEVEL_4_FISCAL_STOCK_CONTROLLED', 'LEVEL_5_AUTO_CLOSING', 'LEVEL_6_FISCAL_AUTOPILOT'];
  const currentIndex = levels.indexOf(data.currentLevel);
  
  if (currentIndex < levels.length - 1) {
    // Mark all requirements for next level as completed
    const nextLevel = levels[currentIndex + 1];
    data.requirements.filter(r => r.level === nextLevel).forEach(r => r.completed = true);
    data.currentLevel = nextLevel as any;
    data.levelName = getLevelName(nextLevel);
    data.progress = Math.round((data.requirements.filter(r => r.completed).length / data.requirements.length) * 100);
    setStored(data);
  }
  return data;
}

function getLevelName(level: string): string {
  const names: Record<string, string> = {
    'LEVEL_1_MESSY': 'Nivel 1 - Baguncado',
    'LEVEL_2_DOCUMENTS_ORGANIZED': 'Nivel 2 - Documentos Organizados',
    'LEVEL_3_REGISTRATIONS_VALIDATED': 'Nivel 3 - Cadastros Validados',
    'LEVEL_4_FISCAL_STOCK_CONTROLLED': 'Nivel 4 - Estoque Fiscal Controlado',
    'LEVEL_5_AUTO_CLOSING': 'Nivel 5 - Fechamento Automatico',
    'LEVEL_6_FISCAL_AUTOPILOT': 'Nivel 6 - Fiscal Autopilot'
  };
  return names[level] || level;
}

export async function getNextLevelPlan(): Promise<string[]> {
  const data = getStored();
  const levels = ['LEVEL_1_MESSY', 'LEVEL_2_DOCUMENTS_ORGANIZED', 'LEVEL_3_REGISTRATIONS_VALIDATED', 'LEVEL_4_FISCAL_STOCK_CONTROLLED', 'LEVEL_5_AUTO_CLOSING', 'LEVEL_6_FISCAL_AUTOPILOT'];
  const currentIndex = levels.indexOf(data.currentLevel);
  if (currentIndex >= levels.length - 1) return ['Voce atingiu o nivel maximo!'];
  
  const nextLevel = levels[currentIndex + 1];
  return data.requirements
    .filter(r => r.level === nextLevel && !r.completed)
    .map(r => r.description);
}

