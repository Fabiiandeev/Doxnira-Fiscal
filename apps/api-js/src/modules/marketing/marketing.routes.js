import { Router } from "express";

import { plansService } from "../plans/plans.service.js";
import { asyncHandler } from "../../utils/response.js";

export const marketingRouter = Router();

marketingRouter.get("/plans", asyncHandler(async (_request, response) => {
  response.json({ plans: await plansService.publicCatalog() });
}));

marketingRouter.get("/features", (_request, response) => {
  response.json({ features: [] });
});

marketingRouter.get("/status", (request, response) => {
  response.json({
    status: "ok",
    services: { catalog: { status: "available" } },
    requestId: request.id ?? null,
  });
});
