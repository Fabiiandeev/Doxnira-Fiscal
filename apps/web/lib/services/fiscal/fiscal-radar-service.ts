import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { FiscalRadarAlert } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-fiscal-radar";

function getStored(): FiscalRadarAlert[] {
  return safeParseStorage<FiscalRadarAlert[]>(STORAGE_KEY, []);
}

function setStored(data: FiscalRadarAlert[]) {
  setStorage(STORAGE_KEY, data);
}

export async function getFiscalRadarAlerts(filters?: { riskLevel?: string; category?: string }): Promise<FiscalRadarAlert[]> {
  await new Promise(res => setTimeout(res, 200));
  let data = getStored();

  if (filters?.riskLevel) {
    data = data.filter(item => item.riskLevel === filters.riskLevel);
  }
  if (filters?.category) {
    data = data.filter(item => item.category === filters.category);
  }

  return data.sort((a, b) => {
    const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (riskOrder[a.riskLevel] || 99) - (riskOrder[b.riskLevel] || 99);
  });
}

export async function autoFixAlert(alertId: string): Promise<FiscalRadarAlert | null> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const index = data.findIndex(item => item.id === alertId);
  if (index === -1) return null;

  data[index] = {
    ...data[index],
    riskLevel: "LOW",
    estimatedImpact: 0,
    actions: ["AUTO_FIX"],
  };
  setStored(data);
  return data[index];
}

export async function applyAISuggestion(alertId: string): Promise<FiscalRadarAlert | null> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const index = data.findIndex(item => item.id === alertId);
  if (index === -1) return null;

  data[index] = {
    ...data[index],
    riskLevel: "LOW",
    estimatedImpact: Math.round(data[index].estimatedImpact * 0.3),
    actions: ["APPLY_AI_SUGGESTION"],
  };
  setStored(data);
  return data[index];
}

export async function sendToAccountant(alertId: string): Promise<FiscalRadarAlert | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === alertId);
  if (index === -1) return null;

  data[index] = {
    ...data[index],
    actions: ["SEND_TO_ACCOUNTANT"],
  };
  setStored(data);
  return data[index];
}

export async function requestClient(alertId: string): Promise<FiscalRadarAlert | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === alertId);
  if (index === -1) return null;

  data[index] = {
    ...data[index],
    actions: ["REQUEST_CLIENT"],
  };
  setStored(data);
  return data[index];
}
