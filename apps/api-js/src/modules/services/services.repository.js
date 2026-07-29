import { prisma } from "../../config/prisma.js";
export const findMany = (companyId, query) => {
  const page = Math.max(1, Number(query.page || 1)); const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
  const where = { companyId, ...(query.active === "true" ? { active: true } : query.active === "false" ? { active: false } : {}), ...(query.q ? { OR: [{ description: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }, { nationalCode: { contains: query.q, mode: "insensitive" } }] } : {}) };
  return Promise.all([prisma.serviceCatalog.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.serviceCatalog.count({ where })]).then(([data, total]) => ({ data, total, page, pageSize }));
};
export const findOne = (companyId, id) => prisma.serviceCatalog.findFirst({ where: { companyId, id } });
export const create = (companyId, data) => prisma.serviceCatalog.create({ data: { companyId, ...data } });
export const update = (companyId, id, data) => prisma.serviceCatalog.updateMany({ where: { companyId, id }, data });
export const remove = (companyId, id) => prisma.serviceCatalog.deleteMany({ where: { companyId, id } });
