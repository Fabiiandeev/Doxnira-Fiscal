import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { FiscalInboxItem } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-fiscal-inbox";

function getStored(): FiscalInboxItem[] {
  return safeParseStorage<FiscalInboxItem[]>(STORAGE_KEY, []);
}

function setStored(data: FiscalInboxItem[]) {
  setStorage(STORAGE_KEY, data);
}

export async function getFiscalInbox(filters?: { priority?: string; status?: string; responsible?: string; companyId?: string }): Promise<FiscalInboxItem[]> {
  await new Promise(res => setTimeout(res, 200));
  let data = getStored();

  if (filters?.priority) {
    data = data.filter(item => item.priority === filters.priority);
  }
  if (filters?.status) {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters?.responsible) {
    data = data.filter(item => item.responsible === filters.responsible);
  }
  if (filters?.companyId) {
    data = data.filter(item => item.companyId === filters.companyId);
  }

  return data.sort((a, b) => {
    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
  });
}

export async function assignToAccountant(itemId: string): Promise<FiscalInboxItem | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  data[index] = { ...data[index], responsible: "ACCOUNTANT", status: "WAITING_ACCOUNTANT" };
  setStored(data);
  return data[index];
}

export async function requestClient(itemId: string): Promise<FiscalInboxItem | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  data[index] = { ...data[index], responsible: "COMPANY", status: "WAITING_CLIENT" };
  setStored(data);
  return data[index];
}

export async function autoFixInboxItem(itemId: string): Promise<FiscalInboxItem | null> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  data[index] = { ...data[index], status: "AUTO_FIXED", responsible: "SYSTEM" };
  setStored(data);
  return data[index];
}

export async function ignoreInboxItem(itemId: string): Promise<FiscalInboxItem | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  data[index] = { ...data[index], status: "IGNORED" };
  setStored(data);
  return data[index];
}

export async function markResolved(itemId: string): Promise<FiscalInboxItem | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  data[index] = { ...data[index], status: "RESOLVED" };
  setStored(data);
  return data[index];
}

export async function bulkAction(itemIds: string[], action: "assign_accountant" | "request_client" | "auto_fix" | "ignore" | "resolve"): Promise<{ success: number; failed: number }> {
  await new Promise(res => setTimeout(res, 500));
  const data = getStored();
  let success = 0;
  let failed = 0;

  for (const itemId of itemIds) {
    const index = data.findIndex(item => item.id === itemId);
    if (index !== -1) {
      switch (action) {
        case "assign_accountant":
          data[index] = { ...data[index], responsible: "ACCOUNTANT", status: "WAITING_ACCOUNTANT" };
          break;
        case "request_client":
          data[index] = { ...data[index], responsible: "COMPANY", status: "WAITING_CLIENT" };
          break;
        case "auto_fix":
          data[index] = { ...data[index], status: "AUTO_FIXED", responsible: "SYSTEM" };
          break;
        case "ignore":
          data[index] = { ...data[index], status: "IGNORED" };
          break;
        case "resolve":
          data[index] = { ...data[index], status: "RESOLVED" };
          break;
      }
      success++;
    } else {
      failed++;
    }
  }

  setStored(data);
  return { success, failed };
}
