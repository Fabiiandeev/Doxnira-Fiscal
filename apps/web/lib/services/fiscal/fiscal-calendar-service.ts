import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { FiscalCalendarItem } from "@/lib/fiscal-types";

const STORAGE_KEY = "fiscal-calendar";

function getStored(): FiscalCalendarItem[] {
  return safeParseStorage<FiscalCalendarItem[]>(STORAGE_KEY, []);
}

function setStored(data: FiscalCalendarItem[]) {
  setStorage(STORAGE_KEY, data);
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
