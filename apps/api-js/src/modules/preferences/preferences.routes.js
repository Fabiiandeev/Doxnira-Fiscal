import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";

const preferenceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  defaultCompanyId: z.string().uuid().optional().nullable(),
  dashboardLayout: z.unknown().optional(),
  tableDensity: z.enum(["compact", "comfortable"]).optional(),
});

export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);

preferencesRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: request.user.id },
    });
    sendSuccess(response, { preferences });
  }),
);

preferencesRouter.patch(
  "/",
  validate(preferenceSchema),
  asyncHandler(async (request, response) => {
    const preferences = await prisma.userPreference.upsert({
      where: { userId: request.user.id },
      create: { userId: request.user.id, ...request.body },
      update: request.body,
    });
    await writeAudit({
      request,
      action: "preference.updated",
      companyId: preferences.defaultCompanyId,
      entityType: "UserPreference",
      entityId: preferences.id,
      metadata: { fields: Object.keys(request.body) },
    });
    sendSuccess(response, { preferences });
  }),
);
