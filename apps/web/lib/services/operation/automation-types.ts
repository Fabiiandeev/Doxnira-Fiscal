import type { OperationPage } from "./purchase-types";
export type AutomationCondition = { field: string; operator: string; value?: unknown; valueType: string; group: string };
export type AutomationAction = { type: string; config: Record<string, unknown>; idempotencyKey?: string; safetyClassification?: string };
export type Automation = { id: string; name: string; description?: string; module: string; event: string; conditions: AutomationCondition[]; conditionLogic: "AND" | "OR"; actions: AutomationAction[]; priority: number; status: string; cooldownSeconds: number; executionLimit?: number; maxDepth: number; allowSelfTrigger: boolean; runs?: AutomationRun[] };
export type AutomationRun = { id: string; automationId: string; automation?: { id: string; name: string }; event: string; payload: unknown; evaluation?: unknown; executedActions?: unknown; skippedActions?: unknown; blockedActions?: unknown; status: string; error?: string; attempt: number; requestId?: string; correlationId: string; causationId?: string; depth: number; origin?: string; startedAt?: string; completedAt?: string; durationMs?: number; createdAt: string };
export type AutomationPage = OperationPage<Automation>;
export type AutomationRunPage = OperationPage<AutomationRun>;
