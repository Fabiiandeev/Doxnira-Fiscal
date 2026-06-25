import { fiscalCalendarMock } from "@/lib/mocks/fiscal-mocks";
import type { FiscalCalendarItem } from "@/lib/fiscal-types";

const STORAGE_KEY = "fiscal-calendar";

function getStored(): FiscalCalendarItem[] {
  if (typeof window === "undefined") return fiscalCalendarMock;

  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored || stored === "undefined" || stored === "null") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalCalendarMock));
    return fiscalCalendarMock;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fiscalCalendarMock));
    return fiscalCalendarMock;
  }
}

function setStored(data: FiscalCalendarItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function getFiscalCalendar(filters?: { status?: string; companyId?: string }): Promise<FiscalCalendarItem[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  let data = getStored();

  if (filters?.status) {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters?.companyId) {
    data = data.filter(item => item.companyId === filters.companyId);
  }

  return data;
}

export async function updateCalendarItem(id: string, patch: Partial<FiscalCalendarItem>) {
  await new Promise(resolve => setTimeout(resolve, 200));
  const items = getStored();
  const updated = items.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );

  setStored(updated);
  return updated.find((item) => item.id === id) ?? null;
}

export async function markAsPaid(id: string): Promise<FiscalCalendarItem | null> {
  return updateCalendarItem(id, { status: "PAID" });
}

export async function attachProof(id: string): Promise<FiscalCalendarItem | null> {
  return updateCalendarItem(id, { status: "PAID" });
}
