import { z } from "zod";

const stateCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const cityCode = z.string().trim().regex(/^\d{7}$/);
const taxId = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{11,20}$/);
const accessKey = z.string().trim().toUpperCase().regex(/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/);
const nonNegativeDecimal = z.union([z.number(), z.string().trim().regex(/^\d+([.,]\d+)?$/)]);
const cents = z.union([z.number().int().nonnegative(), z.string().trim().regex(/^\d+$/)]);

const loadingMunicipalitySchema = z.object({
  stateCode,
  cityCode,
  cityName: z.string().trim().min(2).max(120),
  expectedAt: z.coerce.date().optional().nullable(),
  internalNote: z.string().trim().max(2_000).optional().nullable(),
});

const unloadingCitySchema = z.object({
  stateCode,
  cityCode,
  cityName: z.string().trim().min(2).max(120),
});

const vehicleSchema = z.object({
  plate: z.string().trim().toUpperCase().regex(/^[A-Z]{3}[0-9A-Z][0-9]{2}$/),
  plateState: stateCode.optional().nullable(),
  renavam: z.string().trim().max(20).optional().nullable(),
  rntrc: z.string().trim().max(20).optional().nullable(),
  tareWeight: nonNegativeDecimal.optional().nullable(),
  capacityKg: nonNegativeDecimal.optional().nullable(),
  capacityM3: nonNegativeDecimal.optional().nullable(),
  wheelType: z.string().trim().max(30).optional().nullable(),
  bodyType: z.string().trim().max(30).optional().nullable(),
  ownerType: z.string().trim().max(30).optional().nullable(),
  ownerName: z.string().trim().max(255).optional().nullable(),
  ownerCpfCnpj: taxId.optional().nullable(),
  ownerStateRegistration: z.string().trim().max(40).optional().nullable(),
});

const driverSchema = z.object({
  cpf: z.string().trim().regex(/^\d{11}$/),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(20).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

const fiscalDocumentSchema = z.object({
  documentType: z.enum(["NFE", "CTE"]),
  nfeEntryId: z.string().uuid().optional().nullable(),
  nfeDocumentId: z.string().uuid().optional().nullable(),
  cteEntryId: z.string().uuid().optional().nullable(),
  unloadingCityId: z.string().uuid().optional().nullable(),
  accessKey,
  documentNumber: z.string().trim().max(30).optional().nullable(),
  series: z.string().trim().max(10).optional().nullable(),
  unloadingCityCode: cityCode,
  grossWeight: nonNegativeDecimal.optional().nullable(),
  documentValue: nonNegativeDecimal.optional().nullable(),
  linkSource: z.enum(["MANUAL", "DATABASE", "XML_IMPORT", "SYNC", "AUTHORIZED_NFE_AUTOMATIC"]).default("MANUAL"),
}).superRefine((value, context) => {
  if (value.documentType === "NFE" && value.cteEntryId) {
    context.addIssue({ code: "custom", message: "NF-e não pode apontar para uma entrada CT-e.", path: ["cteEntryId"] });
  }
  if (value.documentType === "CTE" && (value.nfeEntryId || value.nfeDocumentId)) {
    context.addIssue({ code: "custom", message: "CT-e não pode apontar para uma entrada NF-e.", path: ["nfeEntryId"] });
  }
});

const contractorSchema = z.object({
  taxId,
  name: z.string().trim().max(255).optional().nullable(),
  role: z.string().trim().max(40).optional().nullable(),
});

const ciotSchema = z.object({
  contractorId: z.string().uuid().optional().nullable(),
  number: z.string().trim().min(1).max(20),
  responsibleTaxId: taxId,
  status: z.string().trim().max(30).optional().nullable(),
  internalNote: z.string().trim().max(2_000).optional().nullable(),
});

const tollVoucherSchema = z.object({
  providerName: z.string().trim().max(255).optional().nullable(),
  providerCnpj: taxId,
  purchaseNumber: z.string().trim().min(1).max(80),
  amountCents: cents,
  paymentDevice: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(30).optional().nullable(),
});

const paymentComponentSchema = z.object({
  type: z.string().trim().min(1).max(10),
  description: z.string().trim().max(160).optional().nullable(),
  amountCents: cents,
});

const paymentSchema = z.object({
  contractorId: z.string().uuid().optional().nullable(),
  responsibleTaxId: taxId.optional().nullable(),
  paymentMethod: z.string().trim().max(10).optional().nullable(),
  paymentTiming: z.string().trim().max(20).optional().nullable(),
  amountCents: cents.default(0),
  bankCode: z.string().trim().max(10).optional().nullable(),
  branchCode: z.string().trim().max(10).optional().nullable(),
  accountNumber: z.string().trim().max(30).optional().nullable(),
  components: z.array(paymentComponentSchema).max(100).default([]),
});

const insuranceSchema = z.object({
  responsibleType: z.string().trim().min(1).max(30),
  responsibleCpfCnpj: taxId.optional().nullable(),
  insurerName: z.string().trim().min(2).max(255),
  insurerCnpj: taxId,
  policyNumber: z.string().trim().min(1).max(80),
  endorsements: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

const sealSchema = z.object({
  number: z.string().trim().min(1).max(60),
  note: z.string().trim().max(255).optional().nullable(),
});

export const mdfePayloadSchema = z.object({
  series: z.string().trim().regex(/^\d{1,3}$/).default("1"),
  number: z.string().trim().regex(/^\d{1,9}$/).optional().nullable(),
  issuerType: z.enum(["PRESTADOR_SERVICO_TRANSPORTE", "TRANSPORTADOR_CARGA_PROPRIA"]),
  carrierType: z.enum(["ETC", "TAC", "CTC", "PROPRIO"]),
  modal: z.enum(["RODOVIARIO", "AEREO", "AQUAVIARIO", "FERROVIARIO"]).default("RODOVIARIO"),
  emissionType: z.string().trim().max(30).default("NORMAL"),
  emissionDate: z.coerce.date().optional().nullable(),
  tripStartAt: z.coerce.date().optional().nullable(),
  loadingAfter: z.boolean().default(false),
  loadingState: stateCode,
  unloadingState: stateCode,
  currentStep: z.number().int().min(1).max(8).default(1),
  cargoUnit: z.string().trim().max(2).default("01"),
  cargoQuantity: nonNegativeDecimal.default(0),
  predominantProduct: z.string().trim().max(255).optional().nullable(),
  predominantCargoType: z.string().trim().max(10).optional().nullable(),
  predominantNcm: z.string().trim().regex(/^\d{8}$/).optional().nullable(),
  loadingCep: z.string().trim().regex(/^\d{8}$/).optional().nullable(),
  unloadingCep: z.string().trim().regex(/^\d{8}$/).optional().nullable(),
  additionalInfo: z.string().trim().max(5_000).optional().nullable(),
  fiscalInfo: z.string().trim().max(5_000).optional().nullable(),
  internalInfo: z.string().trim().max(5_000).optional().nullable(),
  internalReference: z.string().trim().max(160).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  loadingMunicipalities: z.array(loadingMunicipalitySchema).max(50),
  unloadingCities: z.array(unloadingCitySchema).max(200),
  routeStates: z.array(stateCode).max(27).default([]),
  vehicle: vehicleSchema.optional().nullable(),
  trailers: z.array(vehicleSchema).max(10).default([]),
  drivers: z.array(driverSchema).max(10).default([]),
  fiscalDocuments: z.array(fiscalDocumentSchema).max(20_000).default([]),
  contractors: z.array(contractorSchema).max(100).default([]),
  ciots: z.array(ciotSchema).max(100).default([]),
  tollVouchers: z.array(tollVoucherSchema).max(100).default([]),
  payments: z.array(paymentSchema).max(100).default([]),
  insurances: z.array(insuranceSchema).max(100).default([]),
  seals: z.array(sealSchema).max(100).default([]),
}).superRefine((value, context) => {
  if (value.loadingState && value.unloadingState && value.loadingState === value.unloadingState) {
    context.addIssue({
      code: "custom",
      message: "UF inicial e final devem ser diferentes.",
      path: ["unloadingState"],
    });
  }
  const primaryDrivers = value.drivers.filter((driver) => driver.isPrimary);
  if (primaryDrivers.length > 1) {
    context.addIssue({
      code: "custom",
      message: "Apenas um condutor pode ser principal.",
      path: ["drivers"],
    });
  }
});

export const mdfeUpdateSchema = mdfePayloadSchema.partial();

// A draft must be creatable before the wizard has route and cargo data. The
// complete business constraints remain enforced by /validate and authorization.
export const mdfeDraftCreateSchema = z.object({
  series: z.string().trim().regex(/^\d{1,3}$/).default("1"),
  number: z.string().trim().regex(/^\d{1,9}$/).optional().nullable(),
  issuerType: z
    .enum(["PRESTADOR_SERVICO_TRANSPORTE", "TRANSPORTADOR_CARGA_PROPRIA"])
    .default("PRESTADOR_SERVICO_TRANSPORTE"),
  carrierType: z.enum(["ETC", "TAC", "CTC", "PROPRIO"]).default("ETC"),
  modal: z.enum(["RODOVIARIO", "AEREO", "AQUAVIARIO", "FERROVIARIO"]).default("RODOVIARIO"),
  emissionType: z.string().trim().max(30).default("NORMAL"),
  currentStep: z.number().int().min(1).max(8).default(1),
});

export const mdfeListQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  environment: z.enum(["production", "homologation"]).optional(),
  loadingState: stateCode.optional(),
  unloadingState: stateCode.optional(),
  modal: z.string().trim().max(30).optional(),
  issuerType: z.string().trim().max(30).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const eligibleNfesQuerySchema = z.object({
  establishmentId: z.string().uuid().optional(),
  destinationState: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  destinationCityCode: z.string().regex(/^\d{7}$/).optional(),
  issueDateFrom: z.coerce.date().optional(),
  issueDateTo: z.coerce.date().optional(),
  customerId: z.string().uuid().optional(),
  eligibilityStatus: z.enum([
    "PENDING_EVALUATION", "ELIGIBLE", "INELIGIBLE", "RESERVED",
    "LINKED_TO_DRAFT", "LINKED_TO_ACTIVE_MDFE", "COMPLETED", "RELEASED",
  ]).optional(),
  reservationStatus: z.enum([
    "AVAILABLE", "RESERVED", "LINKED_TO_DRAFT",
    "LINKED_TO_ACTIVE_MDFE", "RELEASED", "COMPLETED",
  ]).optional(),
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const prepareMdfeFromNfesSchema = z.object({
  nfeIds: z.array(z.string().uuid()).min(1).max(100),
  vehicleId: z.string().uuid().optional(),
  trailerIds: z.array(z.string().uuid()).max(5).optional(),
  driverIds: z.array(z.string().uuid()).max(10).optional(),
  departureAt: z.coerce.date().optional(),
  selectedRouteId: z.string().uuid().optional(),
});

export const reprocessNfeAuthorizationSchema = z.object({
  nfeDocumentId: z.string().uuid().optional(),
  establishmentId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]).optional(),
  authorizedFrom: z.coerce.date().optional(),
  authorizedTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).refine(
  (value) => !value.authorizedFrom || !value.authorizedTo || value.authorizedFrom <= value.authorizedTo,
  { message: "Período de autorização inválido.", path: ["authorizedTo"] },
);

export const saveAndAuthorizeMdfeSchema = z.object({
  confirmRoute: z.boolean().default(false),
  confirmPredominantProduct: z.boolean().default(false),
});

export const cancelMdfeSchema = z.object({
  reason: z.string().trim().min(15).max(255),
});

export const closeMdfeSchema = z.object({
  stateCode,
  cityCode,
  cityName: z.string().trim().min(2).max(120),
  closedAt: z.coerce.date().default(() => new Date()),
  internalReason: z.string().trim().max(2_000).optional().nullable(),
});

export const includeDriverSchema = z.object({
  cpf: z.string().trim().regex(/^\d{11}$/),
  name: z.string().trim().min(2).max(160),
});
