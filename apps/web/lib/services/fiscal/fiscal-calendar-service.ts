
import { fiscalCalendarMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalCalendarItem } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-fiscal-calendar';

function getStored(): FiscalCalendarItem[] {
  if (typeof window === 'undefined') return fiscalCalendarMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalCalendarMock));
  return fiscalCalendarMock;
}

function setStored(data: FiscalCalendarItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getFiscalCalendar(filters?: { companyId?: string; status?: string; startDate?: string; endDate?: string }): Promise<FiscalCalendarItem[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  let data = getStored();
  
  if (filters?.companyId) {
    data = data.filter(item => item.companyId === filters.companyId);
  }
  if (filters?.status) {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters?.startDate) {
    data = data.filter(item => item.dueDate >= filters.startDate!);
  }
  if (filters?.endDate) {
    data = data.filter(item => item.dueDate <= filters.endDate!);
  }
  
  return data.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function updateCalendarItem(id: string, updates: Partial<FiscalCalendarItem>): Promise<FiscalCalendarItem | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  data[index] = { ...data[index], ...updates };
  setStored(data);
  return data[index];
}

export async function markAsPaid(id: string, proofUrl?: string): Promise<FiscalCalendarItem | null> {
  return updateCalendarItem(id, { 
    status: 'PAID',
    proofUrl 
  });
}

export async function attachProof(id: string, proofUrl: string): Promise<FiscalCalendarItem | null> {
  return updateCalendarItem(id, { proofUrl });
}

