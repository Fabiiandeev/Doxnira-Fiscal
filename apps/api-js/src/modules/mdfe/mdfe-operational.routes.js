import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { writeAudit } from "../audit/audit.service.js";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";

export const mdfeOperationalRouter = Router({ mergeParams: true });

const optionalText = (max) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(max).nullish(),
);
const uuidOrNull = z.string().uuid().nullable().optional();
const stateSchema = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).nullish(),
);

const establishmentSchema = z.object({
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  legalName: z.string().trim().min(2).max(255),
  tradeName: optionalText(255),
  taxId: z.string().trim().toUpperCase().transform((value) => value.replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().min(8).max(20)),
  stateRegistration: optionalText(40),
  municipalRegistration: optionalText(40),
  cityCode: z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().regex(/^\d{7}$/).nullish(),
  ),
  city: optionalText(120),
  state: stateSchema,
  postalCode: z.preprocess(
    (value) => value === "" ? null : value,
    z.string().trim().transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{8}$/)).nullish(),
  ),
  street: optionalText(255),
  number: optionalText(30),
  complement: optionalText(120),
  district: optionalText(120),
  isHeadquarters: z.boolean().optional(),
  isActive: z.boolean().optional(),
  certificateId: uuidOrNull,
});

const driverSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cpf: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(11)),
  phone: optionalText(20),
  license: optionalText(30),
  licenseType: optionalText(10),
  isActive: z.boolean().optional(),
});

const vehicleSchema = z.object({
  plate: z.string().trim().toUpperCase().transform((value) => value.replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)),
  plateState: stateSchema,
  renavam: optionalText(20),
  rntrc: optionalText(20),
  tareWeight: z.coerce.number().nonnegative().nullish(),
  capacityKg: z.coerce.number().nonnegative().nullish(),
  capacityM3: z.coerce.number().nonnegative().nullish(),
  wheelType: optionalText(30),
  bodyType: optionalText(30),
  ownerType: optionalText(30),
  ownerName: optionalText(255),
  ownerCpfCnpj: optionalText(20),
  ownerStateRegistration: optionalText(40),
  isActive: z.boolean().optional(),
});

const settingSchema = z.object({
  establishmentId: uuidOrNull,
  defaultVehicleId: uuidOrNull,
  defaultDriverId: uuidOrNull,
  defaultSeries: z.string().trim().min(1).max(10).optional(),
  issuerType: z.string().trim().min(1).max(30).optional(),
  carrierType: z.string().trim().min(1).max(30).optional(),
  modal: z.enum(["RODOVIARIO"]).optional(),
  environment: z.enum(["homologation", "production"]).nullable().optional(),
  routeProvider: z.string().trim().min(1).max(80).optional(),
  quickModeEnabled: z.boolean().optional(),
  rntrc: optionalText(20),
  isActive: z.boolean().optional(),
});

function parse(schema, value, partial = false) {
  const result = (partial ? schema.partial() : schema).safeParse(value);
  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message || "Dados inválidos.",
      "VALIDATION_ERROR",
      400,
      result.error.issues,
    );
  }
  return result.data;
}

async function assertCompanyReference(model, id, companyId, label) {
  if (!id) return null;
  const item = await prisma[model].findFirst({
    where: { id, companyId, ...(model === "driver" || model === "fleetVehicle" ? { deletedAt: null } : {}) },
  });
  if (!item) throw new AppError(`${label} não encontrado na empresa.`, "TENANT_REFERENCE_INVALID", 400);
  return item;
}

async function audit(request, action, entityType, entityId, metadata) {
  await writeAudit({
    request,
    action,
    companyId: request.company.id,
    entityType,
    entityId,
    metadata,
  });
}

mdfeOperationalRouter.get("/establishments", asyncHandler(async (request, response) => {
  const data = await prisma.fiscalEstablishment.findMany({
    where: { companyId: request.company.id },
    include: { certificate: { select: { id: true, subject: true, validUntil: true, status: true } } },
    orderBy: [{ isHeadquarters: "desc" }, { code: "asc" }],
  });
  sendSuccess(response, { data });
}));

mdfeOperationalRouter.post("/establishments", asyncHandler(async (request, response) => {
  const payload = parse(establishmentSchema, request.body);
  await assertCompanyReference("digitalCertificate", payload.certificateId, request.company.id, "Certificado");
  const created = await prisma.$transaction(async (tx) => {
    if (payload.isHeadquarters) {
      await tx.fiscalEstablishment.updateMany({
        where: { companyId: request.company.id, isHeadquarters: true },
        data: { isHeadquarters: false },
      });
    }
    return tx.fiscalEstablishment.create({ data: { ...payload, companyId: request.company.id } });
  });
  await audit(request, "mdfe.establishment.created", "FiscalEstablishment", created.id);
  sendSuccess(response, created, 201);
}));

mdfeOperationalRouter.patch("/establishments/:id", asyncHandler(async (request, response) => {
  const current = await assertCompanyReference("fiscalEstablishment", request.params.id, request.company.id, "Estabelecimento");
  const payload = parse(establishmentSchema, request.body, true);
  await assertCompanyReference("digitalCertificate", payload.certificateId, request.company.id, "Certificado");
  if (current.isHeadquarters && payload.isHeadquarters === false) {
    throw new AppError("Defina outra matriz antes de remover a matriz atual.", "HEADQUARTERS_REQUIRED", 409);
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (payload.isHeadquarters) {
      await tx.fiscalEstablishment.updateMany({
        where: { companyId: request.company.id, isHeadquarters: true, id: { not: current.id } },
        data: { isHeadquarters: false },
      });
    }
    return tx.fiscalEstablishment.update({ where: { id: current.id }, data: payload });
  });
  await audit(request, "mdfe.establishment.updated", "FiscalEstablishment", updated.id);
  sendSuccess(response, updated);
}));

mdfeOperationalRouter.get("/drivers", asyncHandler(async (request, response) => {
  const data = await prisma.driver.findMany({
    where: { companyId: request.company.id, deletedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  sendSuccess(response, { data });
}));

mdfeOperationalRouter.post("/drivers", asyncHandler(async (request, response) => {
  const payload = parse(driverSchema, request.body);
  const created = await prisma.driver.create({ data: { ...payload, companyId: request.company.id } });
  await audit(request, "mdfe.driver.created", "Driver", created.id);
  sendSuccess(response, created, 201);
}));

mdfeOperationalRouter.patch("/drivers/:id", asyncHandler(async (request, response) => {
  const current = await assertCompanyReference("driver", request.params.id, request.company.id, "Condutor");
  const updated = await prisma.driver.update({
    where: { id: current.id },
    data: parse(driverSchema, request.body, true),
  });
  await audit(request, "mdfe.driver.updated", "Driver", updated.id);
  sendSuccess(response, updated);
}));

mdfeOperationalRouter.delete("/drivers/:id", asyncHandler(async (request, response) => {
  const current = await assertCompanyReference("driver", request.params.id, request.company.id, "Condutor");
  await prisma.$transaction([
    prisma.mdfeOperationalSetting.updateMany({
      where: { companyId: request.company.id, defaultDriverId: current.id },
      data: { defaultDriverId: null },
    }),
    prisma.driver.update({
      where: { id: current.id },
      data: { isActive: false, deletedAt: new Date() },
    }),
  ]);
  await audit(request, "mdfe.driver.deleted", "Driver", current.id);
  sendSuccess(response, { id: current.id, deleted: true });
}));

mdfeOperationalRouter.get("/fleet-vehicles", asyncHandler(async (request, response) => {
  const data = await prisma.fleetVehicle.findMany({
    where: { companyId: request.company.id, deletedAt: null },
    orderBy: [{ isActive: "desc" }, { plate: "asc" }],
  });
  sendSuccess(response, { data });
}));

mdfeOperationalRouter.post("/fleet-vehicles", asyncHandler(async (request, response) => {
  const payload = parse(vehicleSchema, request.body);
  const created = await prisma.fleetVehicle.create({ data: { ...payload, companyId: request.company.id } });
  await audit(request, "mdfe.vehicle.created", "FleetVehicle", created.id);
  sendSuccess(response, created, 201);
}));

mdfeOperationalRouter.patch("/fleet-vehicles/:id", asyncHandler(async (request, response) => {
  const current = await assertCompanyReference("fleetVehicle", request.params.id, request.company.id, "Veículo");
  const updated = await prisma.fleetVehicle.update({
    where: { id: current.id },
    data: parse(vehicleSchema, request.body, true),
  });
  await audit(request, "mdfe.vehicle.updated", "FleetVehicle", updated.id);
  sendSuccess(response, updated);
}));

mdfeOperationalRouter.delete("/fleet-vehicles/:id", asyncHandler(async (request, response) => {
  const current = await assertCompanyReference("fleetVehicle", request.params.id, request.company.id, "Veículo");
  await prisma.$transaction([
    prisma.mdfeOperationalSetting.updateMany({
      where: { companyId: request.company.id, defaultVehicleId: current.id },
      data: { defaultVehicleId: null },
    }),
    prisma.fleetVehicle.update({
      where: { id: current.id },
      data: { isActive: false, deletedAt: new Date() },
    }),
  ]);
  await audit(request, "mdfe.vehicle.deleted", "FleetVehicle", current.id);
  sendSuccess(response, { id: current.id, deleted: true });
}));

mdfeOperationalRouter.get("/mdfe-settings", asyncHandler(async (request, response) => {
  const data = await prisma.mdfeOperationalSetting.findMany({
    where: { companyId: request.company.id },
    include: { establishment: true, defaultDriver: true, defaultVehicle: true },
    orderBy: { createdAt: "asc" },
  });
  sendSuccess(response, { data });
}));

mdfeOperationalRouter.put("/mdfe-settings", asyncHandler(async (request, response) => {
  const payload = parse(settingSchema, request.body);
  await Promise.all([
    assertCompanyReference("fiscalEstablishment", payload.establishmentId, request.company.id, "Estabelecimento"),
    assertCompanyReference("driver", payload.defaultDriverId, request.company.id, "Condutor"),
    assertCompanyReference("fleetVehicle", payload.defaultVehicleId, request.company.id, "Veículo"),
  ]);
  const where = {
    companyId: request.company.id,
    establishmentId: payload.establishmentId || null,
  };
  const current = await prisma.mdfeOperationalSetting.findFirst({ where });
  const data = { ...payload, companyId: request.company.id, establishmentId: payload.establishmentId || null };
  const updated = current
    ? await prisma.mdfeOperationalSetting.update({ where: { id: current.id }, data })
    : await prisma.mdfeOperationalSetting.create({ data });
  await audit(request, "mdfe.settings.saved", "MdfeOperationalSetting", updated.id, {
    establishmentId: updated.establishmentId,
  });
  sendSuccess(response, updated, current ? 200 : 201);
}));
