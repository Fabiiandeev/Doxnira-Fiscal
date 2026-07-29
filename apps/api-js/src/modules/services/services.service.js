import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import * as repo from "./services.repository.js";
export const listServices = repo.findMany;
export async function getService(companyId, id) { const item = await repo.findOne(companyId, id); if (!item) throw new AppError("Serviço não encontrado.", "SERVICE_NOT_FOUND", 404); return item; }
export async function createService(companyId, userId, data) { try { const item = await repo.create(companyId, data); await audit(companyId, userId, "SERVICE_CREATED", item.id, { after: item }); return item; } catch (e) { if (e.code === "P2002") throw new AppError("Código de serviço duplicado nesta empresa.", "DUPLICATE_SERVICE", 409); throw e; } }
export async function updateService(companyId, userId, id, data) { const before = await getService(companyId, id); try { await repo.update(companyId, id, data); const after = await getService(companyId, id); await audit(companyId, userId, "SERVICE_UPDATED", id, { before, after }); return after; } catch (e) { if (e.code === "P2002") throw new AppError("Código de serviço duplicado nesta empresa.", "DUPLICATE_SERVICE", 409); throw e; } }
export async function deleteService(companyId, userId, id) { const before = await getService(companyId, id); await repo.remove(companyId, id); await audit(companyId, userId, "SERVICE_DELETED", id, { before }); }
const audit = (companyId, userId, action, entityId, metadata) => prisma.auditLog.create({ data: { companyId, userId, action, entityType: "SERVICE_CATALOG", entityId, metadata } });
