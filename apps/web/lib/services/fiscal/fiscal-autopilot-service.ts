import { fiscalAutopilotMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalAutopilotSummary, FiscalAutopilotCategory, FiscalIssue } from '@/lib/fiscal-types';

type AutopilotData = {
  summary: FiscalAutopilotSummary;
  categories: FiscalAutopilotCategory[];
  recentCorrections: Array<{
    id: string;
    action: string;
    entity: string;
    timestamp: string;
    type: string;
    status: string;
  }>;
};

const STORAGE_KEY = 'ns-fiscal-autopilot-data';

function getStoredData(): AutopilotData {
  if (typeof window === 'undefined') return fiscalAutopilotMock as unknown as AutopilotData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  const data = fiscalAutopilotMock as unknown as AutopilotData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function setStoredData(data: AutopilotData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('ns-fiscal-autopilot-updated'));
  }
}

export async function getFiscalAutopilotSummary(): Promise<FiscalAutopilotSummary> {
  const data = getStoredData();
  return data.summary;
}

export async function getFiscalAutopilotCategories(): Promise<FiscalAutopilotCategory[]> {
  const data = getStoredData();
  return data.categories;
}

export async function getFiscalAutopilotIssues(type?: string): Promise<FiscalIssue[]> {
  const data = getStoredData();
  const allIssues = data.categories.flatMap(c => c.items);
  if (type) return allIssues.filter(i => i.type === type);
  return allIssues;
}

export async function applyAutoFix(issueIds: string[]): Promise<{ success: number; failed: number }> {
  const data = getStoredData();
  let success = 0;
  let failed = 0;

  for (const issueId of issueIds) {
    for (const category of data.categories) {
      const issue = category.items.find(i => i.id === issueId);
      if (issue && issue.type === 'AUTO_SAFE') {
        issue.status = 'AUTO_FIXED';
        issue.updatedAt = new Date().toISOString();
        data.summary.autoSafeCount--;
        data.summary.totalIssues--;
        data.summary.correctionsApplied++;
        data.recentCorrections.unshift({
          id: 'log-' + Date.now(),
          action: issue.autoFixAction || 'Correcao automatica aplicada',
          entity: issue.title,
          timestamp: new Date().toISOString(),
          type: 'AUTO_SAFE',
          status: 'SUCCESS',
        });
        success++;
        break;
      } else if (issue) {
        failed++;
      }
    }
  }

  setStoredData(data);
  return { success, failed };
}

export async function applyConfirmation(issueIds: string[]): Promise<{ success: number; failed: number }> {
  const data = getStoredData();
  let success = 0;
  let failed = 0;

  for (const issueId of issueIds) {
    for (const category of data.categories) {
      const issue = category.items.find(i => i.id === issueId);
      if (issue && issue.type === 'AUTO_CONFIRM') {
        issue.status = 'RESOLVED';
        issue.updatedAt = new Date().toISOString();
        data.summary.needsConfirmationCount--;
        data.summary.totalIssues--;
        data.summary.correctionsApplied++;
        data.recentCorrections.unshift({
          id: 'log-' + Date.now(),
          action: issue.autoFixAction || 'Confirmacao aplicada',
          entity: issue.title,
          timestamp: new Date().toISOString(),
          type: 'AUTO_CONFIRM',
          status: 'SUCCESS',
        });
        success++;
        break;
      } else if (issue) {
        failed++;
      }
    }
  }

  setStoredData(data);
  return { success, failed };
}

export async function sendToAccountant(issueIds: string[]): Promise<{ success: number; failed: number }> {
  const data = getStoredData();
  let success = 0;
  let failed = 0;

  for (const issueId of issueIds) {
    for (const category of data.categories) {
      const issue = category.items.find(i => i.id === issueId);
      if (issue && issue.type === 'ACCOUNTANT_REVIEW') {
        issue.status = 'WAITING_ACCOUNTANT';
        issue.updatedAt = new Date().toISOString();
        data.summary.needsAccountantCount--;
        data.summary.totalIssues--;
        data.recentCorrections.unshift({
          id: 'log-' + Date.now(),
          action: 'Enviado para contador',
          entity: issue.title,
          timestamp: new Date().toISOString(),
          type: 'ACCOUNTANT_REVIEW',
          status: 'PENDING',
        });
        success++;
        break;
      } else if (issue) {
        failed++;
      }
    }
  }

  setStoredData(data);
  return { success, failed };
}

export async function getRecentCorrections(): Promise<AutopilotData['recentCorrections']> {
  const data = getStoredData();
  return data.recentCorrections;
}

export async function revalidateAll(): Promise<FiscalAutopilotSummary> {
  const data = getStoredData();
  for (const category of data.categories) {
    for (const issue of category.items) {
      if (issue.status === 'OPEN' && Math.random() > 0.7) {
        issue.status = 'RESOLVED';
        issue.updatedAt = new Date().toISOString();
      }
    }
  }
  const allIssues = data.categories.flatMap(c => c.items);
  data.summary.totalIssues = allIssues.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS' || i.status === 'WAITING_ACCOUNTANT' || i.status === 'WAITING_CLIENT').length;
  data.summary.autoSafeCount = allIssues.filter(i => i.type === 'AUTO_SAFE' && (i.status === 'OPEN' || i.status === 'IN_PROGRESS')).length;
  data.summary.needsConfirmationCount = allIssues.filter(i => i.type === 'AUTO_CONFIRM' && (i.status === 'OPEN' || i.status === 'IN_PROGRESS')).length;
  data.summary.needsAccountantCount = allIssues.filter(i => i.type === 'ACCOUNTANT_REVIEW' && (i.status === 'OPEN' || i.status === 'IN_PROGRESS' || i.status === 'WAITING_ACCOUNTANT')).length;

  setStoredData(data);
  return data.summary;
}
