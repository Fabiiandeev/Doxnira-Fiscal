export type DocumentStatus = "AUTHORIZED" | "CANCELLED" | "EVENT";
export type XmlType = "FULL" | "SUMMARY";
export type ManifestationStatus =
  | "PENDING"
  | "AWARE"
  | "CONFIRMED"
  | "UNKNOWN"
  | "NOT_PERFORMED";

export interface FiscalDocument {
  id: string;
  accessKey: string;
  nsu: string | null;
  invoiceNumber: string | null;
  series: string | null;
  model: string | null;
  documentType: "NFE" | "CTE" | "NFSE" | "OTHER";
  operationDirection:
    | "INBOUND"
    | "OUTBOUND"
    | "TRANSPORT_INBOUND"
    | "TRANSPORT_OUTBOUND"
    | "UNKNOWN";
  companyRole: "ISSUER" | "RECIPIENT" | "TRANSPORT_TAKER" | "OTHER";
  issuerName: string | null;
  issuerCnpj: string | null;
  recipientName: string | null;
  recipientCnpj: string | null;
  emissionDate: string | null;
  totalAmount: number;
  productsAmount: number;
  freightAmount: number;
  discountAmount: number;
  icmsAmount: number;
  ipiAmount: number;
  pisAmount: number;
  cofinsAmount: number;
  icmsBase: number;
  icmsStAmount: number;
  fcpAmount: number;
  otherAmount: number;
  taxAmount: number;
  status: DocumentStatus;
  xmlType: XmlType;
  manifestationStatus: ManifestationStatus;
  isCancelled: boolean;
  uf: string | null;
  cfop: string | null;
  protocol: string | null;
  isNewSupplier?: boolean;
  source: "REAL_SEFAZ" | "MOCK" | "SEED" | "MANUAL_IMPORT" | "ERP_IMPORT";
}

export interface DocumentFilters {
  query: string;
  documentType: string;
  operationDirection: string;
  source: string;
  hasLinkedCte: string;
  status: string;
  xmlType: string;
  manifestation: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  uf: string;
  onlyNewSuppliers: boolean;
}

export type IcmsContribType = "SIM" | "NAO" | "ISENTO";
export type CrtValue = "1" | "2" | "3" | "4";
export type ApuracaoPeriod = "MENSAL" | "TRIMESTRAL";
export type VencimentoOption = "ULTIMO_DIA_UTIL" | "DIA_15" | "DIA_20" | "DIA_25" | "DIA_30";

export interface CompanyTaxSettings {
  id?: string;
  companyId?: string;
  taxRegime: "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "MEI" | "OUTRO" | "PENDENTE_CONFIRMACAO";
  calculationRegime: "COMPETENCIA" | "CAIXA";
  uf: string;
  stateRegistration: string | null;
  mainCnae: string | null;
  simplesAnnex: string | null;
  mainActivity: string | null;
  isIcmsTaxpayer: boolean;
  isIpiTaxpayer: boolean;
  pisCofinsRegime: "CUMULATIVO" | "NAO_CUMULATIVO" | "SIMPLES" | "PENDENTE_CONFIRMACAO";
  accumulatedRevenue: number | null;
  secondaryCnaes: string[] | null;
  icmsContribType: IcmsContribType | null;
  providesService: boolean;
  sellsMerchandise: boolean;
  municipalRegistration: string | null;
  crt: CrtValue | null;
  fiscalConfigComplete: boolean;
  simplesNominalRate: number | null;
  simplesDeductAmount: number | null;
  simplesEffectiveRate: number | null;
  simplesIcmsPercent: number | null;
  simplesIssPercent: number | null;
  simplesCppPercent: number | null;
  simplesFatorR: number | null;
  simplesRevenue12m: number | null;
  simplesPayroll12m: number | null;
  simplesManualOverride: boolean;
  presumidoIrpjBase: number | null;
  presumidoCsllBase: number | null;
  presumidoPisRate: number | null;
  presumidoCofinsRate: number | null;
  presumidoIssRate: number | null;
  presumidoIcmsRate: number | null;
  presumidoIpiRate: number | null;
  presumidoRatPercent: number | null;
  presumidoThirdParty: number | null;
  presumidoInssPatronal: number | null;
  presumidoIrpjVencimento: VencimentoOption | null;
  presumidoCsllVencimento: VencimentoOption | null;
  realapuracaoPeriod: ApuracaoPeriod | null;
  realPisRate: number | null;
  realCofinsRate: number | null;
  realCreditAllowed: boolean;
  realLalurControl: boolean;
  realPrejuizoControl: boolean;
  realIrpjRate: number | null;
  realCsllRate: number | null;
  _completeness?: { fiscalConfigComplete: boolean; missingFields: string[] };
}

export interface MonthlyClosingItem {
  id: string;
  documentId: string | null;
  category: string;
  source: FiscalDocument["source"];
  accessKey: string | null;
  amount: number;
  taxAmount: number;
  snapshot?: Record<string, unknown>;
}

export interface MonthlyClosingWarning {
  id: string;
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
  field?: string | null;
  cause?: string | null;
  suggestion?: string | null;
  autoFix?: { available: boolean; action: string | null; label: string | null } | null;
  documentId?: string | null;
  accessKey?: string | null;
}

export interface MonthlyClosing {
  id: string;
  periodYear: number;
  periodMonth: number;
  status: "DRAFT" | "PROCESSING" | "READY_FOR_REVIEW" | "APPROVED" | "REOPENED" | "ERROR";
  inboundTotal: number;
  outboundTotal: number;
  freightTotal: number;
  icmsTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  estimatedTaxTotal: number;
  includedDocuments: number;
  ignoredDocuments: number;
  approvedAt: string | null;
  items: MonthlyClosingItem[];
  warnings: MonthlyClosingWarning[];
}

export interface FiscalRepairAction {
  code: string;
  target: "certificate" | "company" | "sync";
}

export interface SyncLog {
  id: string;
  startedAt: string;
  finishedAt?: string | null;
  status: "SUCCESS" | "WAITING" | "WARNING" | "ERROR" | "QUEUED" | "RUNNING";
  cstat?: string | null;
  xmotivo?: string | null;
  requestNsu?: string | null;
  responseUltNsu?: string | null;
  responseMaxNsu?: string | null;
  documentsCount: number;
  documentsReceived: number;
  documentsSaved: number;
  mode: "real" | "mock";
  environment?: "production" | "homologation" | null;
  errorMessage?: string | null;
  duration?: string;
}

export * from "./fiscal-types";
