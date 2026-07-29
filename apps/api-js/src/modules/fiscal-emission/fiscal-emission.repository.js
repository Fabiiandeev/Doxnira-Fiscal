import { prisma } from "../../config/prisma.js";
export const company = (id) => prisma.company.findUnique({ where:{id}, include:{taxSettings:true} });
export const customer = (companyId,id) => prisma.client.findFirst({where:{companyId,id}});
export const service = (companyId,id) => prisma.serviceCatalog.findFirst({where:{companyId,id}});
export const logs = (companyId,type) => prisma.auditLog.findMany({where:{companyId,entityType:type},orderBy:{createdAt:"desc"},take:500});
export const log = (data) => prisma.auditLog.create({data});
