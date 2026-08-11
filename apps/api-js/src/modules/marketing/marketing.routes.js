import { Router } from "express";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/response.js";
import { getFeatures, getPlans, getStatus, postContact, postLead } from "./marketing.controller.js";
import { contactSchema, leadSchema } from "./marketing.schemas.js";

export const marketingRouter = Router();
const readLimit = rateLimit({ key: "public-marketing-read", max: 120 });
const writeLimit = rateLimit({ key: "public-marketing-write", max: 10, windowMs: 60_000 });
marketingRouter.get("/plans", readLimit, asyncHandler(getPlans));
marketingRouter.get("/features", readLimit, asyncHandler(getFeatures));
marketingRouter.get("/status", readLimit, asyncHandler(getStatus));
marketingRouter.post("/leads", writeLimit, validate(leadSchema), asyncHandler(postLead));
marketingRouter.post("/contact", writeLimit, validate(contactSchema), asyncHandler(postContact));
