import { prisma } from "../../config/prisma.js";
import { operationNotFound } from "./operation-errors.js";
import { runAutomation } from "./automation-runner.js";
import { scopedAutomation, scopedAutomationRun } from "./operation.repository.js";

export const createAutomation = (companyId, input) => prisma.operationAutomation.create({ data: { companyId, ...input } });
export const updateAutomation = async (companyId, id, input) => {
  if (!await scopedAutomation(prisma, companyId, id)) throw operationNotFound("Automação");
  return prisma.operationAutomation.update({ where: { id }, data: input });
};
export const duplicateAutomation = async (companyId, id) => {
  const source = await scopedAutomation(prisma, companyId, id);
  if (!source) throw operationNotFound("Automação");
  return prisma.operationAutomation.create({ data: { companyId, name: `${source.name} (cópia)`, description: source.description, module: source.module, event: source.event, conditions: source.conditions, conditionLogic: source.conditionLogic, actions: source.actions, priority: source.priority, status: "INACTIVE", startsAt: source.startsAt, endsAt: source.endsAt, executionLimit: source.executionLimit, cooldownSeconds: source.cooldownSeconds, responsibleId: source.responsibleId, allowSelfTrigger: source.allowSelfTrigger, maxDepth: source.maxDepth } });
};
export const retryAutomationRun = async (companyId, id, userId) => {
  const previous = await scopedAutomationRun(prisma, companyId, id);
  if (!previous) throw operationNotFound("Execução");
  return runAutomation(previous.automation, { event: previous.event, payload: previous.payload, idempotencyKey: `retry:${previous.id}:${previous.attempt + 1}`, correlationId: previous.correlationId, causationId: previous.id, depth: previous.depth, requestId: previous.requestId, origin: "RETRY", attempt: previous.attempt + 1 }, userId);
};
