import type { SegmentPackage } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-segment-packages";

const defaultPackages: SegmentPackage[] = [
  {
    id: "cell-store",
    name: "Loja de celular",
    description: "Regras fiscais comuns para venda de aparelhos, acessorios e manutencao.",
    commonNcms: ["8517.13.00", "8518.30.00"],
    commonCfops: ["5102", "6102"],
    commonCsts: ["00", "20", "60"],
    commonPendencies: ["NCM 8517 sem CEST", "CFOP 5102 sem CST", "ICMS-ST nao configurado"],
    stockRules: ["Controle de estoque obrigatorio para NCM 8517", "Inventario anual obrigatorio"],
    fiscalChecklist: ["Verificar IPI na entrada", "Validar regime PJ/Simples", "Checar FCP na venda"],
    customAlerts: ["Certificado digital vencendo", "Rejeicao 905 - CAMPO NAO INFORMADO"],
  },
  {
    id: "auto-parts",
    name: "Autopecas",
    description: "Pacote para entrada, saida e estoque fiscal de pecas automotivas.",
    commonNcms: ["8708.99.90", "8511.10.00"],
    commonCfops: ["1102", "5102"],
    commonCsts: ["00", "10", "60"],
    commonPendencies: ["NCM 8708 com ST", "CFOP 1102 sem IPI", "PIS/COFINS nao configurado"],
    stockRules: ["Controle de estoque com ST", "Inventario semestral para IPI", "Bloqueio de NCMs sem TIPI"],
    fiscalChecklist: ["Verificar substituicao tributaria", "Validar IPI na entrada", "Checar FCP e ICMS-ST"],
    customAlerts: ["NCM 8708 com ST obrigatorio", "Divergencia NCM/TIPI"],
  },
  {
    id: "restaurant",
    name: "Restaurante / Delivery",
    description: "Pacote para operacoes de alimentacao com NFC-e, ISS e PIS/COFINS.",
    commonNcms: ["2106.90.10", "2202.10.00"],
    commonCfops: ["5102", "5405"],
    commonCsts: ["00", "41", "60"],
    commonPendencies: ["NFC-e sem CEST", "ISS nao configurado", "PIS/COFINS monofasico"],
    stockRules: ["Inventario simplificado", "Controle de insumos", "Apuracao mensal"],
    fiscalChecklist: ["Verificar monofasico PIS/COFINS", "Validar ISS no municipio", "Checar CEST nos produtos"],
    customAlerts: ["NFC-e com CST invalido", "ISS pendente no municipio"],
  },
];

function getStored(): SegmentPackage[] {
  if (typeof window === "undefined") return defaultPackages;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPackages));
  return defaultPackages;
}

function setStored(data: SegmentPackage[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getSegmentPackages(): Promise<SegmentPackage[]> {
  await new Promise(res => setTimeout(res, 200));
  return getStored();
}

export async function applySegmentPackage(packageId: string, companyId: string): Promise<{ success: boolean; packageId: string; companyId: string }> {
  await new Promise(res => setTimeout(res, 300));
  return { success: true, packageId, companyId };
}

export async function copyRulesBetweenCompanies(fromCompanyId: string, toCompanyId: string): Promise<{ success: boolean; fromCompanyId: string; toCompanyId: string }> {
  await new Promise(res => setTimeout(res, 200));
  return { success: true, fromCompanyId, toCompanyId };
}

export async function createCustomPackage(payload: Omit<SegmentPackage, "id">): Promise<SegmentPackage> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const created: SegmentPackage = {
    id: "pkg-" + Date.now(),
    ...payload,
  };
  data.push(created);
  setStored(data);
  return created;
}
