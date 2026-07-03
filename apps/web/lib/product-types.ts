export interface Product {
  id: string;
  companyId: string;
  name: string;
  code: string;
  barcode: string | null;
  brand: string | null;
  unit: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  ncm: string | null;
  ncmDescription: string | null;
  cest: string | null;
  exTipi: string | null;
  origemMercadoria: number | null;
  anp: string | null;
  tipoItem: number | null;
  grupoTributario: string | null;
  cstCsosnPadrao: string | null;
  cfopPreferencial: string | null;
  icmsPadrao: number | null;
  icmsStPadrao: number | null;
  mvaPadrao: number | null;
  ipiPadrao: number | null;
  pisPadrao: number | null;
  cofinsPadrao: number | null;
  issPadrao: number | null;
  beneficioFiscalCod: string | null;
  beneficioRedBase: number | null;
  beneficioDiferimento: boolean | null;
  beneficioIsencao: boolean | null;
  obsFiscal: string | null;
  price: number;
  costPrice: number | null;
  stock: number;
  stockMin: number | null;
  stockMax: number | null;
  active: boolean;
  fiscalAi: FiscalAiProduct | null;
  scoreProduto: number | null;
  historicoJson: HistoricoProduto[] | null;
  createdAt: string;
  updatedAt: string;
}

export type PartialProduct = Partial<Product>;

export const ORIGEM_MERCADORIA: Record<number, string> = {
  0: "Nacional, exceto as indicadas nos códigos 3 a 5",
  1: "Estrangeira - Importação direta, exceto a indicada no código 6",
  2: "Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7",
  3: "Nacional, mercadoria ou bem com conteúdo de importação superior a 40% e inferior ou igual a 70%",
  4: "Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos (PPB)",
  5: "Nacional, mercadoria ou bem com conteúdo de importação inferior ou igual a 40%",
  6: "Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CNPE e habilitada",
  7: "Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CNPE e habilitada",
  8: "Nacional, mercadoria ou bem com conteúdo de importação superior a 70%",
};

export const TIPO_ITEM: Record<number, string> = {
  0: "Serviço",
  1: "Mercadoria para Revenda",
  2: "Matéria-Prima",
  3: "Embalagem",
  4: "Produto em Processo",
  5: "Produto Acabado",
  6: "Subproduto",
  7: "Produto Intermediário",
  8: "Material de Uso e Consumo",
  9: "Ativo Imobilizado",
  10: "Outros insumos",
  99: "Outras",
};

export const CST_ICMS_LUCRO_PRESUMIDO = [
  "00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90",
];

export const CSOSN_SIMPLES = [
  "101", "102", "103", "201", "202", "203", "300", "400", "500", "900",
];

export interface Cfop {
  id: string;
  cfop?: string;
  code?: string;
  codigo: string;
  description?: string;
  descricao: string;
  tipo: string;
  operacao: string | null;
  operationNature?: string | null;
  operationType?: string | null;
  destinationType?: string | null;
  defaultAdditionalInfo?: string | null;
  fiscalRules?: unknown;
  isActive?: boolean;
  dentroEstado: boolean;
  interestadual: boolean;
  exterior: boolean;
  ativo: boolean;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalAiProduct {
  ncmValido: boolean;
  cestObrigatorio: boolean;
  beneficioFiscal: boolean;
  tributacaoSugerida: string | null;
  origem: string | null;
  st: boolean;
  monofasico: boolean;
  ipi: boolean;
  fcp: boolean;
  difal: boolean;
  cfopInterno: string | null;
  cfopInterestadual: string | null;
  cfopDevolucao: string | null;
  cfopBonificacao: string | null;
  cfopRemessa: string | null;
  cfopRetorno: string | null;
  cfopExportacao: string | null;
  observacoesFiscais: string | null;
  icmsPadrao: number | null;
  mvaPadrao: number | null;
  pisPadrao: number | null;
  cofinsPadrao: number | null;
  ipiPadrao: number | null;
  cstCsosnSugerido: string | null;
}

export interface NcmClassification {
  ncm: string;
  descricao: string;
  capitulo: string;
  capituloDescricao: string;
  posicao: string;
  subposicao: string;
  cestObrigatorio: boolean;
  exTipi: boolean;
}

export interface NcmAnalysisResult {
  valid: boolean;
  isCatalogued: boolean;
  classification: NcmClassification;
  incidences: Record<string, string>;
  rules: Array<{ label: string; value: string }>;
  alerts: Array<{ type: "warning" | "info" | "error"; message: string }>;
  recommendations: Array<{ icon: string; message: string }>;
  ncmLookup: {
    ncm: string;
    descricao: string;
    capitulo: string;
    cestObrigatorio: boolean;
    st: boolean;
    monofasico: boolean;
    ipi: boolean;
    fcp: boolean;
    aliquotaInterestadual: number | null;
  };
}

export interface HistoricoProduto {
  quem: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  origem: string;
  data: string;
}

export interface CfopOption {
  codigo: string;
  descricao: string;
  aplicacao: string;
  recomendado: boolean;
  motivo: string;
}

export interface TaxLine {
  rate: number | null;
  value: number | null;
  source: string;
  loaded?: boolean;
  message?: string;
}

export interface IcmsSimulation {
  cfopOptions: CfopOption[];
  selectedCfop: string | null;
  cst: { tipo: string; codigo: string; descricao: string; fonte: string };
  origem: { codigo: number | null; descricao: string };
  aliquota: TaxLine;
  aliquotaInterestadual: { rate: number; loaded: boolean; source: string } | null;
  baseCalculo: number;
  reducaoBc: { rate: number; source: string };
  fcp: TaxLine;
  difal: { applies: boolean; loaded: boolean; message: string; source: string };
  icmsSt: { applies: boolean | null; rate: number | null; loaded: boolean; source: string; message: string | null };
}

export interface TributosFederaisSimulation {
  pis: TaxLine;
  cofins: TaxLine;
  ipi: TaxLine;
}

export interface ReformaTributariaSimulation {
  ibs: TaxLine;
  cbs: TaxLine;
  impostoSeletivo: TaxLine;
  cClassTrib: { codigo: string | null; descricao: string; source: string };
  cstIbsCbs: { codigo: string | null; descricao: string; source: string };
  baseIbsCbs: number | null;
  aliquotaIbs: TaxLine;
  aliquotaCbs: TaxLine;
  valorIbs: { value: number | null; source: string; message?: string };
  valorCbs: { value: number | null; source: string; message?: string };
  splitPayment: { applies: boolean | null; message: string; source: string };
  creditoFinanceiro: { applies: boolean | null; message: string; source: string };
  dataVigencia: string;
  compatibilidadeNt: string;
}

export interface ResultadoSimulation {
  valorProdutos: number;
  totalTributosAtuais: number;
  percentualCargaAtual: number;
  reforma: { totalEstimado: number | null; message: string };
  totalEfetivo: number;
  baseLegal: string;
  observacoes: string;
  riscoFiscal: string;
  confiancaIa: number;
  camposUsados: string[];
  camposPendentes: string[];
  exigirConfirmacaoHumano: boolean;
  notasTecnicas: string[];
}

export interface FiscalSimulationResult {
  icms: IcmsSimulation;
  tributosFederais: TributosFederaisSimulation;
  reformaTributaria: ReformaTributariaSimulation;
  resultado: ResultadoSimulation;
  score: number;
}

export type TaxStatus =
  | "CALCULATED"
  | "NOT_APPLICABLE"
  | "PENDING_RULE"
  | "BLOCKED"
  | "ZERO_BY_REGIME";

export type SimulationMode = "SIMULATION" | "OFFICIAL_NFE";

export interface TaxDecisionLine {
  tax: string;
  status: TaxStatus;
  base: number | null;
  rate: number | null;
  value: number | null;
  rule: string;
  source: string;
  confidence: number;
  explanation: string;
  pendingFields: string[];
}

export interface FiscalAIClassification {
  isInternal: boolean;
  isInterestadual: boolean;
  operationType: string;
  isSimples: boolean;
  isRegimeNormal: boolean;
  difalApplies: boolean;
  isContribuinte: boolean;
  isConsumidorFinal: boolean;
}

export interface FiscalAICfopResult {
  options: CfopOption[];
  selectedCfop: string | null;
  selectedCfopInfo: CfopOption | null;
  justificativa: string;
  fonte: string;
}

export interface FiscalAICstCsosnResult {
  tipo: string;
  codigo: string;
  descricao: string;
  aplicacao: string;
  fonte: string;
}

export interface FiscalAINfeBlock {
  id: string;
  field: string;
  severity: string;
  message: string;
}

export interface FiscalAIAuditResult {
  score: number;
  riskLevel: string;
  riskLabel: string;
  issues: Array<FiscalAINfeBlock & { auditorImpact?: number }>;
  requireHumanConfirm: boolean;
  canEmitNfe: boolean;
  auditSummary: string;
}

export interface FiscalSimulationResultV2 {
  mode: SimulationMode;
  valid: boolean;
  pipeline: Array<Record<string, unknown>>;
  classification: FiscalAIClassification;
  cfop: FiscalAICfopResult;
  cstCsosn: FiscalAICstCsosnResult;
  taxes: Record<string, TaxDecisionLine>;
  totals: {
    valorProdutos: number;
    totalTributos: number;
    percentualCarga: number;
    baseIcms: number;
  };
  nfeRules: {
    valid: boolean;
    blocks: FiscalAINfeBlock[];
    warnings: FiscalAINfeBlock[];
    infoNotes: FiscalAINfeBlock[];
  };
  audit: FiscalAIAuditResult;
  camposPendentes: string[];
  notasTecnicas: string[];
  errors?: Array<{ field: string; message: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

export interface SimulateFiscalParams {
  ncm: string;
  ufOrigem: string;
  ufDestino: string;
  crt?: string;
  regime?: string;
  tipoOperacao?: string;
  consumidorFinal?: boolean;
  contribuinteIcms?: boolean;
  finalidade?: string;
  valorProduto: number;
  frete?: number;
  seguro?: number;
  desconto?: number;
  selectedCfop?: string;
}
