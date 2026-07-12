import type { AuditLogEntry } from "@/lib/fiscal-types";
import { safeParseStorage, setStorage } from "@/lib/safe-storage";

const STORAGE_KEY = "ns-fiscal-audit-logs";
const MAX_LOGS = 200;

function getStored(): AuditLogEntry[] {
  return safeParseStorage<AuditLogEntry[]>(STORAGE_KEY, []);
}

function saveStored(logs: AuditLogEntry[]) {
  const trimmed = [...logs]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, MAX_LOGS);
  setStorage(STORAGE_KEY, trimmed);
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  return getStored().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function createAuditLog(
  entry: Omit<AuditLogEntry, "id" | "timestamp">,
): Promise<AuditLogEntry> {
  const created: AuditLogEntry = {
    id: globalThis.crypto?.randomUUID?.() ??
      `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  saveStored([created, ...getStored()]);
  return created;
}

export async function clearAuditLogs(): Promise<void> {
  saveStored([]);
}
