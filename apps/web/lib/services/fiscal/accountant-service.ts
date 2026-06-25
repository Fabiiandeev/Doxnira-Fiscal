
import { accountantRiskMock, accountantWorkQueueMock, clientRequestsMock } from '@/lib/mocks/fiscal-mocks';
import type { AccountantRiskRanking, AccountantWorkQueueItem, ClientRequest } from '@/lib/fiscal-types';

const RISK_KEY = 'ns-accountant-risk';
const QUEUE_KEY = 'ns-accountant-queue';
const REQUESTS_KEY = 'ns-client-requests';

function getRiskData(): AccountantRiskRanking {
  if (typeof window === 'undefined') return accountantRiskMock;
  const stored = localStorage.getItem(RISK_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(RISK_KEY, JSON.stringify(accountantRiskMock));
  return accountantRiskMock;
}

function getQueueData(): AccountantWorkQueueItem[] {
  if (typeof window === 'undefined') return accountantWorkQueueMock;
  const stored = localStorage.getItem(QUEUE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(accountantWorkQueueMock));
  return accountantWorkQueueMock;
}

function setQueueData(data: AccountantWorkQueueItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(data));
  }
}

function getRequestsData(): ClientRequest[] {
  if (typeof window === 'undefined') return clientRequestsMock;
  const stored = localStorage.getItem(REQUESTS_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(clientRequestsMock));
  return clientRequestsMock;
}

function setRequestsData(data: ClientRequest[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(data));
  }
}

export async function getAccountantRiskRanking(): Promise<AccountantRiskRanking> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return getRiskData();
}

export async function getAccountantWorkQueue(filters?: { column?: string; companyId?: string }): Promise<AccountantWorkQueueItem[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  let data = getQueueData();
  
  if (filters?.column) {
    data = data.filter(item => item.column === filters.column);
  }
  if (filters?.companyId) {
    data = data.filter(item => item.companyId === filters.companyId);
  }
  
  return data;
}

export async function updateWorkQueueItem(id: string, updates: Partial<AccountantWorkQueueItem>): Promise<AccountantWorkQueueItem | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getQueueData();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  data[index] = { ...data[index], ...updates };
  setQueueData(data);
  return data[index];
}

export async function moveWorkQueueItem(id: string, newColumn: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED'): Promise<AccountantWorkQueueItem | null> {
  return updateWorkQueueItem(id, { column: newColumn, status: newColumn === 'RESOLVED' ? 'RESOLVED' : 'OPEN' });
}

export async function getClientRequests(filters?: { companyId?: string; status?: string }): Promise<ClientRequest[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  let data = getRequestsData();
  
  if (filters?.companyId) {
    data = data.filter(item => item.companyId === filters.companyId);
  }
  if (filters?.status) {
    data = data.filter(item => item.status === filters.status);
  }
  
  return data.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export async function sendClientRequest(request: Omit<ClientRequest, 'id' | 'sentAt'>): Promise<ClientRequest> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data = getRequestsData();
  const newRequest: ClientRequest = {
    ...request,
    id: 'req-' + Date.now(),
    sentAt: new Date().toISOString(),
  };
  data.unshift(newRequest);
  setRequestsData(data);
  return newRequest;
}

export async function updateClientRequestStatus(id: string, status: ClientRequest['status']): Promise<ClientRequest | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getRequestsData();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  const updates: Partial<ClientRequest> = { status };
  if (status === 'VIEWED' && !data[index].viewedAt) updates.viewedAt = new Date().toISOString();
  if (status === 'ANSWERED' && !data[index].answeredAt) updates.answeredAt = new Date().toISOString();
  if (status === 'RESOLVED' && !data[index].resolvedAt) updates.resolvedAt = new Date().toISOString();
  
  data[index] = { ...data[index], ...updates };
  setRequestsData(data);
  return data[index];
}

export async function resendClientRequest(id: string, channels: ClientRequest['channels']): Promise<ClientRequest | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data = getRequestsData();
  const index = data.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  data[index] = { 
    ...data[index], 
    channels, 
    sentAt: new Date().toISOString(),
    status: 'SENT',
    viewedAt: undefined,
    answeredAt: undefined
  };
  setRequestsData(data);
  return data[index];
}

