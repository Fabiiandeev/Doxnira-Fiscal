import { prisma } from "../config/prisma.js";

export function getActiveTaxRules(companyId, periodEnd) {
  return prisma.taxRule.findMany({
    where: {
      companyId,
      effectiveFrom: { lt: periodEnd },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: periodEnd } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}
