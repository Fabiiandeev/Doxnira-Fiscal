import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { NfseNationalChecklist } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-nfse-national";

function getStored(): NfseNationalChecklist[] {
  return safeParseStorage<NfseNationalChecklist[]>(STORAGE_KEY, []);
}

function setStored(data: NfseNationalChecklist[]) {
  setStorage(STORAGE_KEY, data);
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
  const item = data[index];
  if (item.providerRegistered && item.nationalCodePending === 0 && item.municipalityPending === 0 && item.retentionsNotConfigured === 0 && item.incompleteTakners === 0) {
    item.status = "COMPLETE";
  } else if (item.providerRegistered) {
    item.status = "IN_PROGRESS";
  }

  setStored(data);
  return data[index];
}

export async function prepareCompany(companyId: string): Promise<NfseNationalChecklist | null> {
  return updateNfseItem(companyId, { providerRegistered: true });
}

export async function generateNfseReport(companyId?: string): Promise<{ company: string | undefined; checklist: NfseNationalChecklist | undefined; recommendations: string[] }> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const target = companyId ? data.find(d => d.companyId === companyId) : data[0];
  return {
    company: target?.companyName,
    checklist: target,
    recommendations: target
      ? [
          "Cadastrar codigos nacionais dos servicos pendentes",
          "Configurar municipios de incidencia",
          "Revisar retencoes por municipio",
          "Completar dados dos tomadores",
        ]
      : [],
  };
}
