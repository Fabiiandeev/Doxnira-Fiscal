
import { nfseNationalMock } from '@/lib/mocks/fiscal-mocks';
import type { NfseNationalChecklist } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-nfse-national';

function getStored(): NfseNationalChecklist[] {
  if (typeof window === 'undefined') return nfseNationalMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nfseNationalMock));
  return nfseNationalMock;
}

function setStored(data: NfseNationalChecklist[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getNfseNationalStatus(companyId?: string): Promise<NfseNationalChecklist[]> {
  await new Promise(res => setTimeout(res, 200));
  let data = getStored();
  if (companyId) {
    data = data.filter(item => item.companyId === companyId);
  }
  return data;
}

export async function updateNfseItem(companyId: string, updates: Partial<NfseNationalChecklist>): Promise<NfseNationalChecklist | null> {
  await new Promise(res => setTimeout(res, 200));
  const data = getStored();
  const index = data.findIndex(item => item.companyId === companyId);
  if (index === -1) return null;
  
  data[index] = { ...data[index], ...updates };
  // Auto-calculate status
  const item = data[index];
  if (item.providerRegistered && item.nationalCodePending === 0 && item.municipalityPending === 0 && item.retentionsNotConfigured === 0 && item.incompleteTakners === 0) {
    item.status = 'COMPLETE';
  } else if (item.providerRegistered) {
    item.status = 'IN_PROGRESS';
  }
  
  setStored(data);
  return data[index];
}

export async function prepareCompany(companyId: string): Promise<NfseNationalChecklist | null> {
  return updateNfseItem(companyId, { providerRegistered: true });
}

export async function importNfseMock(companyId: string): Promise<any> {
  await new Promise(res => setTimeout(res, 500));
  return { success: true, imported: 15, message: 'NFS-e mockadas importadas com sucesso' };
}

export async function generateNfseReport(companyId?: string): Promise<any> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const target = companyId ? data.find(d => d.companyId === companyId) : data[0];
  return {
    company: target?.companyName,
    checklist: target,
    recommendations: [
      'Cadastrar codigos nacionais dos servicos pendentes',
      'Configurar municipios de incidencia',
      'Revisar retencoes por municipio',
      'Completar dados dos tomadores'
    ]
  };
}

