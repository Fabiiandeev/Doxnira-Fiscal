import { apiFetch } from '@/lib/api';
import type { AccountantRiskRanking, AccountantWorkQueueItem, ClientRequest } from '@/lib/fiscal-types';

export async function getAccountantRiskRanking(): Promise<AccountantRiskRanking> {
  return apiFetch('/accountant/risk-ranking') as Promise<AccountantRiskRanking>;
}

export async function getAccountantWorkQueue(filters?: { column?: string; companyId?: string }): Promise<AccountantWorkQueueItem[]> {
  const params = new URLSearchParams();
  if (filters?.column) params.set('column', filters.column);
  if (filters?.companyId) params.set('companyId', filters.companyId);
  const qs = params.toString();
  return apiFetch(`/accountant/work-queue${qs ? `?${qs}` : ''}`) as Promise<AccountantWorkQueueItem[]>;
}

export async function updateWorkQueueItem(id: string, updates: Partial<AccountantWorkQueueItem>): Promise<AccountantWorkQueueItem | null> {
  return apiFetch(`/accountant/work-queue/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }) as Promise<AccountantWorkQueueItem | null>;
}

export async function moveWorkQueueItem(id: string, newColumn: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED'): Promise<AccountantWorkQueueItem | null> {
  return updateWorkQueueItem(id, { column: newColumn, status: newColumn === 'RESOLVED' ? 'RESOLVED' : 'OPEN' });
}

export async function getClientRequests(filters?: { companyId?: string; status?: string }): Promise<ClientRequest[]> {
  const params = new URLSearchParams();
  if (filters?.companyId) params.set('companyId', filters.companyId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/accountant/client-requests${qs ? `?${qs}` : ''}`) as Promise<ClientRequest[]>;
}

export async function sendClientRequest(request: Omit<ClientRequest, 'id' | 'sentAt'>): Promise<ClientRequest> {
  return apiFetch('/accountant/client-requests', {
    method: 'POST',
    body: JSON.stringify(request),
  }) as Promise<ClientRequest>;
}

export async function updateClientRequestStatus(id: string, status: ClientRequest['status']): Promise<ClientRequest | null> {
  return apiFetch(`/accountant/client-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }) as Promise<ClientRequest | null>;
}

export async function resendClientRequest(id: string, channels: ClientRequest['channels']): Promise<ClientRequest | null> {
  return apiFetch(`/accountant/client-requests/${id}/resend`, {
    method: 'POST',
    body: JSON.stringify({ channels }),
  }) as Promise<ClientRequest | null>;
}

export async function completeActionPlanItem(companyId: string, planItemId: string): Promise<AccountantRiskRanking | null> {
  return apiFetch(`/accountant/action-plan/${planItemId}/complete?companyId=${encodeURIComponent(companyId)}`, {
    method: 'PATCH',
  }) as Promise<AccountantRiskRanking | null>;
}
