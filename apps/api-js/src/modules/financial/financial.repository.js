import { prisma } from "../../config/prisma.js";
export const financialRepository={
 list:(model,companyId,where,page,pageSize)=>prisma.$transaction([prisma[model].findMany({where:{companyId,...where},orderBy:{dueDate:"asc"},skip:(page-1)*pageSize,take:pageSize}),prisma[model].count({where:{companyId,...where}})]),
 find:(model,companyId,id)=>prisma[model].findFirst({where:{id,companyId}}),
 categories:(companyId)=>prisma.financialCategory.findMany({where:{companyId},orderBy:{name:"asc"}}),
 centers:(companyId)=>prisma.costCenter.findMany({where:{companyId},orderBy:{name:"asc"}}),
 accounts:(companyId)=>prisma.financialAccount.findMany({where:{companyId},orderBy:{name:"asc"}}),
};
