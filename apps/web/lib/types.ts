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
  nsu: string;
  invoiceNumber: string;
  series: string;
  issuerName: string;
  issuerCnpj: string;
  recipientName: string;
  recipientCnpj: string;
  emissionDate: string;
  totalAmount: number;
  status: DocumentStatus;
  xmlType: XmlType;
  manifestationStatus: ManifestationStatus;
  isCancelled: boolean;
  uf: string;
  cfop: string;
  protocol: string;
  isNewSupplier?: boolean;
}

export interface DocumentFilters {
  query: string;
  documentType: string;
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
  errorMessage?: string | null;
  duration?: string;
}
