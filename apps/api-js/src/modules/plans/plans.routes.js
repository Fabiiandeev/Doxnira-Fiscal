import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { writeAudit } from "../audit/audit.service.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { AppError } from "../../utils/app-error.js";
import { createPlanSchema, createPriceSchema, parse, planIdSchema, updateFeaturesSchema, updatePlanSchema } from "./plans.schemas.js";
import { plansService } from "./plans.service.js";

export const publicPlansRouter = Router();
export const subscriptionPlansRouter = Router();
export const platformPlansRouter = Router();

const platformRoles = new Set(["PLATFORM_ADMIN", "PLATFORM_SUPER_ADMIN"]);
export const isPlatformRole = (role) => platformRoles.has(role);
function platform(permission) {
  return (request, _response, next) => {
    if (!platformRoles.has(request.user?.role)) return next(new AppError("Permissão de plataforma necessária.", "PLATFORM_PERMISSION_DENIED", 403, { permission }));
    request.platformPermission = permission;
    return next();
  };
}
const id = (request) => parse(planIdSchema, request.params).planId;
const audit = (request, action, planId, metadata) => writeAudit({ request, action, entityType: "SubscriptionPlan", entityId: planId, metadata });

publicPlansRouter.get("/", asyncHandler(async (_request, response) => sendSuccess(response, { plans: await plansService.publicCatalog() })));
subscriptionPlansRouter.use(requireAuth);
subscriptionPlansRouter.get("/", asyncHandler(async (_request, response) => sendSuccess(response, { plans: await plansService.subscriptionCatalog() })));
subscriptionPlansRouter.get("/:planId", asyncHandler(async (request, response) => sendSuccess(response, await plansService.get(id(request)))));

platformPlansRouter.use(requireAuth);
platformPlansRouter.get("/", platform("platform.plans.read"), asyncHandler(async (_request, response) => sendSuccess(response, { plans: await plansService.listPlatform() })));
platformPlansRouter.post("/", rateLimit({ policy: "SENSITIVE_WRITE" }), platform("platform.plans.create"), asyncHandler(async (request, response) => {
  const plan = await plansService.create(parse(createPlanSchema, request.body), request.user.id);
  await audit(request, "PLAN_CREATED", plan.id, { code: plan.code });
  sendSuccess(response, plan, 201);
}));
platformPlansRouter.get("/:planId", platform("platform.plans.read"), asyncHandler(async (request, response) => sendSuccess(response, await plansService.get(id(request)))));
platformPlansRouter.patch("/:planId", rateLimit({ policy: "SENSITIVE_WRITE" }), platform("platform.plans.update"), asyncHandler(async (request, response) => {
  const planId = id(request); const plan = await plansService.update(planId, parse(updatePlanSchema, request.body), request.user.id);
  await audit(request, "PLAN_UPDATED", planId);
  sendSuccess(response, plan);
}));
platformPlansRouter.post("/:planId/prices", rateLimit({ policy: "SENSITIVE_WRITE" }), platform("platform.plans.prices.manage"), asyncHandler(async (request, response) => {
  const planId = id(request); const input = parse(createPriceSchema, request.body);
  const result = await plansService.createPrice(planId, input, request.user.id);
  await audit(request, input.validFrom > new Date() ? "PLAN_PRICE_SCHEDULED" : "PLAN_PRICE_CREATED", planId, { oldAmountCents: result.oldAmountCents, newAmountCents: input.amountCents, validFrom: input.validFrom, applicationPolicy: input.applicationPolicy });
  sendSuccess(response, result.price, 201);
}));
platformPlansRouter.put("/:planId/features", rateLimit({ policy: "SENSITIVE_WRITE" }), platform("platform.plans.update"), asyncHandler(async (request, response) => {
  const planId = id(request); const plan = await plansService.replaceFeatures(planId, parse(updateFeaturesSchema, request.body).features);
  await audit(request, "PLAN_UPDATED", planId, { section: "features" });
  sendSuccess(response, plan);
}));
for (const [action, permission, event] of [
  ["publish", "platform.plans.publish", "PLAN_PUBLISHED"],
  ["unpublish", "platform.plans.publish", "PLAN_UNPUBLISHED"],
  ["activate-sales", "platform.plans.publish", "PLAN_SALES_ENABLED"],
  ["deactivate-sales", "platform.plans.publish", "PLAN_SALES_DISABLED"],
  ["archive", "platform.plans.archive", "PLAN_ARCHIVED"],
]) {
  platformPlansRouter.post(`/:planId/${action}`, rateLimit({ policy: "SENSITIVE_WRITE" }), platform(permission), asyncHandler(async (request, response) => {
    const planId = id(request); const plan = await plansService.transition(planId, action, request.user.id);
    await audit(request, event, planId);
    sendSuccess(response, plan);
  }));
}
