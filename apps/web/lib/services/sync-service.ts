import { apiFetch } from "@/lib/api";
import type { SyncLog } from "@/lib/types";

export interface SyncReadiness {
  companyId: string;
  certificate: {
    exists: boolean;
    valid: boolean;
    expired: boolean;
    cnpjCompatible: boolean;
    daysRemaining: number | null;
    status: string;
  };
  sefaz: {
    integrationEnabled: boolean;
    environment: string;
    mode: "mock" | "real";
  };
  sync: {
    ready: boolean;
    status: string;
    message: string;
    nextAllowedSyncAt: string | null;
  };
}

export async function getSyncReadiness(companyId: string) {
  return apiFetch<SyncReadiness>(`/companies/${companyId}/sync/readiness`);
}

export async function requestSync(companyId: string) {
  return apiFetch<{ id: string; jobId: string; status: string; message: string }>(
    `/companies/${companyId}/sync/nfe`,
    { method: "POST" },
  );
}

export async function getSyncStatus(companyId: string) {
  return apiFetch<{
    latest: (SyncLog & { syncState?: string }) | null;
    company: {
      nfeLastNsu: string;
      nfeMaxNsu: string | null;
      nextAllowedSyncAt: string | null;
      lastSyncAt: string | null;
    };
  }>(`/companies/${companyId}/sync/status`);
}

export async function getSyncLogs(companyId: string, page = 1) {
  return apiFetch<{
    data: SyncLog[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(`/companies/${companyId}/sync/logs?page=${page}&pageSize=10`);
}
