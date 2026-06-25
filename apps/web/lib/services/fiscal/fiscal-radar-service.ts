
import { fiscalRadarMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalRadarAlert } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-fiscal-radar';

function getStored(): FiscalRadarAlert[] {
  if (typeof window === 'undefined') return fiscalRadarMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalRadarMock));
  return fiscalRadarMock;
}

function setStored(data: FiscalRadarAlert[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
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
    const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
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
    riskLevel: 'LOW',
    estimatedImpact: 0,
    actions: ['MARK_RESOLVED'],
    resolvedAt: new Date().toISOString()
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
    riskLevel: Math.random() > 0.5 ? 'LOW' : 'MEDIUM',
    estimatedImpact: data[index].estimatedImpact * 0.3,
    actions: ['MARK_RESOLVED'],
    aiAppliedAt: new Date().toISOString()
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
    actions: ['MARK_RESOLVED'],
    sentToAccountantAt: new Date().toISOString()
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
    actions: ['MARK_RESOLVED'],
    requestedClientAt: new Date().toISOString()
  };
  setStored(data);
  return data[index];
}

