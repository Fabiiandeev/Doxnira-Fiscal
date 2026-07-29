import { prisma } from "../../config/prisma.js";
import { runAutomation } from "./automation-runner.js";

export const dispatchOperationEvent = async ({ companyId, event, payload, correlationId, causationId, depth = 0, requestId, origin = "SYSTEM", userId = null }) => {
  const rules = await prisma.operationAutomation.findMany({ where: { companyId, event, status: "ACTIVE" }, orderBy: { priority: "desc" } });
  const runs = [];
  for (const rule of rules) runs.push(await runAutomation(rule, { event, payload, correlationId, causationId, depth, requestId, origin, idempotencyKey: `${event}:${correlationId || requestId || "event"}:${rule.id}` }, userId));
  return runs;
};
