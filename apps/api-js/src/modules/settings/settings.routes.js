import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { createSettingsRepository } from "./settings.repository.js";
import { settingsListSchema, companySettingsSchema, integrationActionSchema } from "./settings.schemas.js";
import { updateCompanySettings, assertSettingsWrite } from "./settings.service.js";
import { listIntegrationSettings } from "./integration-settings.service.js";
import { certificateSummary } from "./certificate.service.js";
import { listUserAccess } from "./user-access.service.js";
import { queryAudit } from "./audit-query.service.js";
import { settingsErrors } from "./settings-errors.js";

export const settingsRouter = Router({ mergeParams: true });
const repository = createSettingsRepository(prisma);

settingsRouter.get("/", asyncHandler(async (request, response) => {
  const [company, certificate, integrations, users] = await Promise.all([repository.company(request.company.id), repository.certificate(request.company.id), listIntegrationSettings(repository, request.company.id), listUserAccess(prisma, request.company)]);
  sendSuccess(response, { company, certificate: certificateSummary(certificate), integrations, users });
}));
settingsRouter.get("/company", asyncHandler(async (request, response) => sendSuccess(response, await repository.company(request.company.id))));
settingsRouter.patch("/company", asyncHandler(async (request, response) => sendSuccess(response, await updateCompanySettings(prisma, request, companySettingsSchema.parse(request.body)))));
settingsRouter.get("/fiscal", asyncHandler(async (request, response) => {
  const company = await repository.company(request.company.id); const certificate = certificateSummary(await repository.certificate(request.company.id));
  const issues = [];
  if (certificate.status === "NOT_CONFIGURED" || ["EXPIRED","INVALID","REVOKED"].includes(certificate.status)) issues.push({ code: "CERTIFICATE_REQUIRED", severity: "BLOCKING", message: "Certificado válido necessário para transmissão." });
  if (!company.taxSettings?.crt || !company.taxSettings?.taxRegime) issues.push({ code: "TAX_REGIME_INCOMPLETE", severity: "BLOCKING", message: "Regime tributário e CRT precisam ser configurados." });
  if (!company.city) issues.push({ code: "CITY_REQUIRED", severity: "BLOCKING", message: "Município precisa ser configurado." });
  sendSuccess(response, { settings: company.taxSettings, environment: company.environment, issues, transmissionAllowed: company.environment === "production" && !issues.length });
}));
settingsRouter.get("/certificate", asyncHandler(async (request, response) => sendSuccess(response, certificateSummary(await repository.certificate(request.company.id)))));
settingsRouter.post("/certificate/revoke", asyncHandler(async (request, response) => {
  assertSettingsWrite(request); const certificate = await repository.certificate(request.company.id); if (!certificate) throw settingsErrors.integrationMissing();
  const updated = await prisma.digitalCertificate.update({ where: { id: certificate.id }, data: { status: "revoked" }, select: { id: true, serialNumber: true, subject: true, issuer: true, validFrom: true, validUntil: true, holderCnpj: true, validatedAt: true, status: true, createdAt: true, updatedAt: true } });
  await prisma.auditLog.create({ data: { companyId: request.company.id, userId: request.user.id, action: "certificate.revoked", entityType: "DigitalCertificate", entityId: certificate.id, metadata: { requestId: request.id } } });
  sendSuccess(response, certificateSummary(updated));
}));
settingsRouter.get("/integrations", asyncHandler(async (request, response) => sendSuccess(response, { items: await listIntegrationSettings(repository, request.company.id) })));
settingsRouter.post("/integrations/:provider/action", asyncHandler(async (request, response) => {
  assertSettingsWrite(request); const { action } = integrationActionSchema.parse(request.body); const provider = request.params.provider.toUpperCase();
  const items = await listIntegrationSettings(repository, request.company.id); const item = items.find((row) => row.provider === provider); if (!item) throw settingsErrors.integrationMissing();
  if (action === "test" && item.status === "CONFIGURATION_REQUIRED") throw settingsErrors.integrationMissing();
  await prisma.auditLog.create({ data: { companyId: request.company.id, userId: request.user.id, action: `integration.${action}`, entityType: "IntegrationSetting", metadata: { provider, observedStatus: item.status, requestId: request.id } } });
  sendSuccess(response, { ...item, testResult: action === "test" ? item.status : undefined, simulated: false });
}));
settingsRouter.get("/users", asyncHandler(async (request, response) => sendSuccess(response, { items: await listUserAccess(prisma, request.company), pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })));
settingsRouter.get("/audit", asyncHandler(async (request, response) => sendSuccess(response, await queryAudit(prisma, request.company.id, settingsListSchema.parse(request.query)))));
settingsRouter.get("/audit/export", asyncHandler(async (request, response) => {
  if (!["OWNER","ADMIN"].includes(request.user.role)) throw settingsErrors.writeForbidden();
  const result = await queryAudit(prisma, request.company.id, { ...settingsListSchema.parse(request.query), page: 1, pageSize: 100 });
  response.type("text/csv").send(["data,usuario,acao,recurso", ...result.items.map((row) => [row.createdAt.toISOString(), row.user?.email || "", row.action, row.entityType || ""].map((value) => `"${String(value).replaceAll('"','""')}"`).join(","))].join("\n"));
}));
