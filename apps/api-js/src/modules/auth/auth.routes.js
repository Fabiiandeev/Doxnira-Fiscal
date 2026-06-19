import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { loginUser, registerUser } from "./auth.service.js";

const credentialsSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(6).max(128),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().min(2).max(160),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  rateLimit({ key: "register", max: 10, windowMs: 15 * 60_000 }),
  validate(registerSchema),
  asyncHandler(async (request, response) => {
    const result = await registerUser(request.body);
    await writeAudit({ request, action: "auth.register", userId: result.user.id });
    sendSuccess(response, result, 201);
  }),
);

authRouter.post(
  "/login",
  rateLimit({ key: "login", max: 10, windowMs: 15 * 60_000 }),
  validate(credentialsSchema),
  asyncHandler(async (request, response) => {
    const result = await loginUser(request.body);
    request.user = result.user;
    await writeAudit({ request, action: "auth.login" });
    sendSuccess(response, result);
  }),
);

authRouter.get("/me", requireAuth, (request, response) => {
  sendSuccess(response, { user: request.user });
});

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (request, response) => {
    await writeAudit({ request, action: "auth.logout" });
    sendSuccess(response, { message: "Sessão encerrada." });
  }),
);
