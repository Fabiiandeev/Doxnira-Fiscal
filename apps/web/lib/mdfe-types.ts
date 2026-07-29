export type MdfeStatus =
  | "DRAFT" | "VALIDATING" | "VALIDATION_FAILED" | "READY_TO_AUTHORIZE"
  | "SIGNING" | "SIGNED" | "AUTHORIZING" | "AUTHORIZED" | "IN_TRANSIT"
  | "REJECTED" | "DENIED" | "CANCELLING" | "CANCELLED"
  | "CLOSING" | "CLOSED" | "CONTINGENCY" | "ERROR";

export type MdfeValidationIssue = {
  code: string;
  severity: "BLOCKING" | "WARNING" | "INFO";
  field?: string | null;
  message: string;
  suggestion?: string | null;
  autoFix?: { available: boolean; action?: string | null; label?: string | null } | null;
};

export type MdfePayload = {
  series?: string;
  number?: string | null;
  issuerType?: "PRESTADOR_SERVICO_TRANSPORTE" | "TRANSPORTADOR_CARGA_PROPRIA";
  carrierType?: "ETC" | "TAC" | "CTC" | "PROPRIO";
  modal?: "RODOVIARIO" | "AEREO" | "AQUAVIARIO" | "FERROVIARIO";
  emissionType?: string;
  loadingState?: string;
  unloadingState?: string;
  currentStep?: number;
  cargoUnit?: string;
  cargoQuantity?: number | string;
  predominantProduct?: string | null;
  predominantNcm?: string | null;
  additionalInfo?: string | null;
  fiscalInfo?: string | null;
  internalInfo?: string | null;
  loadingMunicipalities?: Array<{ stateCode: string; cityCode: string; cityName: string }>;
  unloadingCities?: Array<{ stateCode: string; cityCode: string; cityName: string }>;
  routeStates?: string[];
  vehicle?: {
    plate: string; plateState?: string | null; renavam?: string | null;
    rntrc?: string | null; tareWeight?: number | string | null;
    capacityKg?: number | string | null; wheelType?: string | null; bodyType?: string | null;
  } | null;
  trailers?: Array<Record<string, unknown>>;
  drivers?: Array<{ cpf: string; name: string; phone?: string | null; isPrimary?: boolean }>;
  fiscalDocuments?: Array<{
    documentType: "NFE" | "CTE"; accessKey: string; unloadingCityCode: string;
    documentValue?: number | string | null; grossWeight?: number | string | null;
    linkSource?: "MANUAL" | "DATABASE" | "XML_IMPORT" | "SYNC";
  }>;
  contractors?: Array<Record<string, unknown>>;
  ciots?: Array<Record<string, unknown>>;
  tollVouchers?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  insurances?: Array<Record<string, unknown>>;
  seals?: Array<Record<string, unknown>>;
};

export type Mdfe = MdfePayload & {
  id: string;
  status: MdfeStatus;
  environment: "production" | "homologation";
  accessKey?: string | null;
  protocol?: string | null;
  statusCode?: string | null;
  statusReason?: string | null;
  emissionDate: string;
  updatedAt: string;
  totalCargoCents?: string | number;
  totalWeightKg?: string | number;
  vehicle?: (NonNullable<MdfePayload["vehicle"]> & { id?: string }) | null;
  drivers?: Array<{ id?: string; cpf: string; name: string; phone?: string | null; isPrimary?: boolean }>;
  fiscalDocuments?: Array<Record<string, unknown>>;
  validations?: Array<MdfeValidationIssue & { id?: string; createdAt?: string }>;
  events?: Array<Record<string, unknown>>;
  audits?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type MdfeListResponse = {
  data: Mdfe[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: Record<string, number>;
};

export type MdfeValidationResult = {
  valid: boolean;
  issues: MdfeValidationIssue[];
  mdfe?: Mdfe;
};
