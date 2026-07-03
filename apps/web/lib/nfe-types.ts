export type NfeStatus =
  | "RASCUNHO"
  | "EM_VALIDACAO"
  | "PRONTA_TRANSMISSAO"
  | "TRANSMITINDO"
  | "PROCESSANDO_SEFAZ"
  | "AUTORIZADA"
  | "REJEITADA"
  | "CANCELADA"
  | "DENEGADA"
  | "INUTILIZADA";

export type NfeListItem = {
  id: string;
  number: number | null;
  series: number | null;
  customerName: string | null;
  customerDocument: string | null;
  emissionDate: string | null;
  value: string | number | null;
  status: NfeStatus;
  environment: string;
  protocol: string | null;
  updatedAt: string;
  accessKey: string | null;
  operationType: string | null;
  canTransmit: boolean;
  message?: string | null;
  cfop?: string | null;
  operationNature?: string | null;
};

export type NfeSummary = {
  total: number;
  drafts: number;
  validating: number;
  rejected: number;
  authorized: number;
  cancelled: number;
  authorizedValue: number;
  pending: number;
};

export type NfeFilters = {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
  environment: string;
  customer: string;
  number: string;
  series: string;
  accessKey: string;
  value: string;
  uf: string;
  operationType: string;
};

export type NfeListResponse = {
  data: NfeListItem[];
  summary: NfeSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type NfeActionResponse = {
  id?: string;
  data?: NfeListItem;
  message?: string;
  canTransmit?: boolean;
  ok?: boolean;
};

export type NfeEmitter = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string | null;
  stateRegistrationStatus?: string | null;
  municipalRegistration: string | null;
  cnae: string | null;
  crt: string | null;
  taxRegime: string | null;
  uf: string | null;
  city: string | null;
  environment: string;
};

export type NfeItem = {
  id: string;
  itemNumber: number;
  productId: string | null;
  productCode: string | null;
  ean: string | null;
  description: string;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  cst: string | null;
  csosn: string | null;
  origem: number | null;
  unidade: string;
  quantidade: string | number;
  valorUnitario: string | number;
  valorTotal: string | number;
  descontoValor: string | number;
  freightValue?: string | number;
  insuranceValue?: string | number;
  otherCosts?: string | number;
  icmsBase?: string | number;
  icmsRate?: string | number;
  icmsAmount?: string | number;
  ipiBase?: string | number;
  ipiRate?: string | number;
  ipiAmount?: string | number;
  pisBase?: string | number;
  pisRate?: string | number;
  pisAmount?: string | number;
  cofinsBase?: string | number;
  cofinsRate?: string | number;
  cofinsAmount?: string | number;
};

export type NfeTotal = {
  valorProdutos: string | number;
  valorTotal: string | number;
  desconto: string | number;
  frete: string | number;
  seguro: string | number;
  outrasDespesas: string | number;
  totalIcmsBase: string | number;
  totalIcms: string | number;
  totalIcmsStBase: string | number;
  totalIcmsSt: string | number;
  totalFcp: string | number;
  totalIpi: string | number;
  totalPis: string | number;
  totalCofins: string | number;
};

export type NfeDocumentDetail = {
  id: string;
  companyId: string;
  status: NfeStatus;
  numero: number | null;
  serie: number | null;
  modelo: string;
  naturezaOperacao: string | null;
  cfop: string | null;
  tipoOperacao: string | null;
  finalidade: string | null;
  consumoFinal: boolean | null;
  indicadorPresenca: string | null;
  idDest: string | null;
  additionalInfo: string | null;
  fiscoInfo: string | null;
  pedidoRef: string | null;
  justificativa: string | null;
  ambiente: string;
  dataEmissao: string | null;
  dataSaida: string | null;
  horaSaida: string | null;
  destinatarioId: string | null;
  destinatarioNome: string | null;
  destinatarioCnpj: string | null;
  destinatarioCpf: string | null;
  destinatarioIe: string | null;
  destinatarioUf: string | null;
  totals: NfeTotal | null;
  items: NfeItem[];
  emitente: NfeEmitter | null;
  canTransmit: boolean;
  validationScore: number | null;
  xMotivo: string | null;
  updatedAt: string;
};

export type NfeDetailResponse = {
  data: NfeDocumentDetail;
};

export type NfeDetailActionResponse = {
  data: NfeDocumentDetail;
  message?: string;
  canTransmit?: boolean;
  validation?: unknown;
};
