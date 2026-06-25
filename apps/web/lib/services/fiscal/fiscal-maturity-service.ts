import { fiscalMaturityMock } from "@/lib/mocks/fiscal-mocks";
import type { FiscalMaturityData, FiscalMaturityLevel } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-fiscal-maturity";

function getStored(): FiscalMaturityData {
  if (typeof window === "undefined") return fiscalMaturityMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalMaturityMock));
  return fiscalMaturityMock;
}

function setStored(data: FiscalMaturityData) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

const LEVELS: FiscalMaturityLevel[] = [
  "LEVEL_1_MESSY",
  "LEVEL_2_DOCUMENTS_ORGANIZED",
  "LEVEL_3_REGISTRATIONS_VALIDATED",
  "LEVEL_4_FISCAL_STOCK_CONTROLLED",
  "LEVEL_5_AUTO_CLOSING",
  "LEVEL_6_FISCAL_AUTOPILOT",
];

function getLevelName(level: string): string {
  const names: Record<string, string> = {
    LEVEL_1_MESSY: "Nivel 1 - Baguncado",
    LEVEL_2_DOCUMENTS_ORGANIZED: "Nivel 2 - Documentos Organizados",
    LEVEL_3_REGISTRATIONS_VALIDATED: "Nivel 3 - Cadastros Validados",
    LEVEL_4_FISCAL_STOCK_CONTROLLED: "Nivel 4 - Estoque Fiscal Controlado",
    LEVEL_5_AUTO_CLOSING: "Nivel 5 - Fechamento Automatico",
    LEVEL_6_FISCAL_AUTOPILOT: "Nivel 6 - Fiscal Autopilot",
  };
  return names[level] || level;
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
    const total = data.requirements.length;
    const completed = data.requirements.filter(r => r.completed).length;
    data.progress = Math.round((completed / total) * 100);

    const currentIndex = LEVELS.indexOf(data.currentLevel);
    const nextLevel = currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;
    if (nextLevel) {
      const nextLevelReqs = data.requirements.filter(r => r.level === nextLevel && !r.completed);
      if (nextLevelReqs.length === 0) {
        data.currentLevel = nextLevel;
        data.levelName = getLevelName(nextLevel);
      }
    }

    data.nextLevelRequirements = getNextLevelReqs(data);
    setStored(data);
  }
  return data;
}

function getNextLevelReqs(data: FiscalMaturityData): string[] {
  const currentIndex = LEVELS.indexOf(data.currentLevel);
  if (currentIndex >= LEVELS.length - 1) return [];
  const nextLevel = LEVELS[currentIndex + 1];
  return data.requirements
    .filter(r => r.level === nextLevel && !r.completed)
    .map(r => r.description);
}

export async function advanceLevel(): Promise<FiscalMaturityData> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const currentIndex = LEVELS.indexOf(data.currentLevel);

  if (currentIndex < LEVELS.length - 1) {
    const nextLevel = LEVELS[currentIndex + 1];
    data.requirements.filter(r => r.level === nextLevel).forEach(r => { r.completed = true; });
    data.currentLevel = nextLevel;
    data.levelName = getLevelName(nextLevel);
    data.progress = Math.round((data.requirements.filter(r => r.completed).length / data.requirements.length) * 100);
    data.nextLevelRequirements = getNextLevelReqs(data);
    setStored(data);
  }
  return data;
}

export async function getNextLevelPlan(): Promise<string[]> {
  const data = getStored();
  return data.nextLevelRequirements;
}
