import { apiFetch, getCompanyId } from "@/lib/api";
import type { Mdfe, MdfeListResponse, MdfePayload, MdfeValidationResult } from "@/lib/mdfe-types";

const base = () => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return `/companies/${companyId}/mdfe`;
};

const mutationHeaders = () => ({ "idempotency-key": crypto.randomUUID() });

export type EligibleNfe = {
  id: string;
  accessKey: string;
  number: number;
  series: number;
  authorizedAt: string;
  customerName: string;
  destinationCityCode: string;
  destinationCityName: string;
  destinationState: string;
  totalAmountCents: number;
  grossWeight: number;
  netWeight: number;
  packageQuantity: number;
  eligibilityStatus: string;
  eligibilityReason?: string;
  reservationStatus: string;
};

export type EligibleNfeResponse = {
  data: EligibleNfe[];
  summary: Array<{
    state: string;
    documentCount: number;
    municipalityCount: number;
    totalAmountCents: number;
    grossWeight: number;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type PreparedMdfeGroup = {
  mdfeId: string;
  unloadingState: string;
  loadingCityName: string;
  loadingState: string;
  documentCount: number;
  municipalityCount: number;
  totalCargoCents: number;
  grossWeight: number;
  vehicleConfigured: boolean;
  driverConfigured: boolean;
  routeConfigured: boolean;
  certificateReady: boolean;
  blockingIssues: string[];
  warnings: number;
  status: string;
};

export const mdfeService = {
  list: (query = "") => apiFetch<MdfeListResponse>(`${base()}${query ? `?${query}` : ""}`),
  get: (id: string) => apiFetch<Mdfe>(`${base()}/${id}`),
  create: (data: MdfePayload = {}) =>
    apiFetch<Mdfe>(base(), { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: MdfePayload) =>
    apiFetch<Mdfe>(`${base()}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`${base()}/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => apiFetch<Mdfe>(`${base()}/${id}/duplicate`, { method: "POST" }),
  validate: (id: string) =>
    apiFetch<MdfeValidationResult>(`${base()}/${id}/validate`, { method: "POST" }),
  generateXml: (id: string) =>
    apiFetch<Record<string, unknown>>(`${base()}/${id}/xml/generate`, { method: "POST" }),
  sign: (id: string) => apiFetch<Mdfe>(`${base()}/${id}/sign`, { method: "POST" }),
  authorize: (id: string) =>
    apiFetch<Mdfe>(`${base()}/${id}/authorize`, { method: "POST", headers: mutationHeaders() }),
  reconcile: (id: string) => apiFetch<Mdfe>(`${base()}/${id}/reconcile`, { method: "POST" }),
  cancel: (id: string, reason: string) =>
    apiFetch<Mdfe>(`${base()}/${id}/cancel`, {
      method: "POST", headers: mutationHeaders(), body: JSON.stringify({ reason }),
    }),
  close: (id: string, data: { stateCode: string; cityCode: string; cityName: string }) =>
    apiFetch<Mdfe>(`${base()}/${id}/close`, {
      method: "POST", headers: mutationHeaders(), body: JSON.stringify(data),
    }),
  includeDriver: (id: string, data: { cpf: string; name: string }) =>
    apiFetch<Mdfe>(`${base()}/${id}/events/include-driver`, {
      method: "POST", headers: mutationHeaders(), body: JSON.stringify(data),
    }),
  events: (id: string) => apiFetch<Array<Record<string, unknown>>>(`${base()}/${id}/events`),
  audit: (id: string) => apiFetch<Array<Record<string, unknown>>>(`${base()}/${id}/audit`),
  open: (remote = false) => apiFetch<Record<string, unknown>>(`${base()}/open?remote=${remote}`),
  statusService: () => apiFetch<Record<string, unknown>>(`${base()}/status-service`),
  eligibleNfes: (query = "") =>
    apiFetch<EligibleNfeResponse>(`${base()}/eligible-nfes${query ? `?${query}` : ""}`),
  reevaluateNfe: (nfeId: string) =>
    apiFetch<Record<string, unknown>>(`${base()}/eligible-nfes/${nfeId}/evaluate`, { method: "POST" }),
  prepareFromNfes: (nfeIds: string[], idempotencyKey: string) =>
    apiFetch<{ groups: PreparedMdfeGroup[]; groupCount: number }>(`${base()}/prepare-from-nfes`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify({ nfeIds }),
    }),
  saveAndAuthorize: (
    id: string,
    idempotencyKey: string,
    confirmations: { confirmRoute?: boolean; confirmPredominantProduct?: boolean } = {},
  ) =>
    apiFetch<Record<string, unknown>>(`${base()}/${id}/save-and-authorize`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(confirmations),
    }),
  xmlUrl: (id: string) => `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api"}${base()}/${id}/xml`,
  damdfeUrl: (id: string) => `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api"}${base()}/${id}/damdfe`,
};
