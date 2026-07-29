import { Router } from "express";
import { z } from "zod";

import { optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler, sendSuccess } from "../../utils/response.js";
import { writeAudit } from "../audit/audit.service.js";
import { loginUser, registerUser } from "./auth.service.js";
import { clearSessionCookies, issueSession, revokeSession, setSessionCookies } from "./session.service.js";

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
  rateLimit({ policy: "AUTH_STRICT" }),
  validate(registerSchema),
  asyncHandler(async (request, response) => {
    const result = await registerUser(request.body);
    const session = issueSession(result.user);
    setSessionCookies(response, session);
    await writeAudit({ request, action: "auth.register", userId: result.user.id });
    sendSuccess(response, { user: result.user, csrfToken: session.csrfToken }, 201);
  }),
);

authRouter.post(
  "/login",
  rateLimit({ policy: "AUTH_STRICT" }),
  validate(credentialsSchema),
  asyncHandler(async (request, response) => {
    const result = await loginUser(request.body);
    const session = issueSession(result.user);
    setSessionCookies(response, session);
    request.user = result.user;
    await writeAudit({ request, action: "auth.login" });
    sendSuccess(response, { user: result.user, csrfToken: session.csrfToken });
  }),
);

authRouter.get("/me", requireAuth, (request, response) => {
  sendSuccess(response, { user: request.user });
});

authRouter.post("/refresh", rateLimit({ policy: "AUTH_STRICT" }), requireAuth, asyncHandler(async (request, response) => {
  await revokeSession(request.auth.payload);
  const session = issueSession(request.user);
  setSessionCookies(response, session);
  await writeAudit({ request, action: "auth.session_rotated" });
  sendSuccess(response, { user: request.user, csrfToken: session.csrfToken });
}));

authRouter.post(
  "/logout",
  optionalAuth,
  asyncHandler(async (request, response) => {
    if (request.auth?.payload) await revokeSession(request.auth.payload);
    clearSessionCookies(response);
    if (request.user) await writeAudit({ request, action: "auth.logout" });
    sendSuccess(response, { message: "Sessão encerrada." });
  }),
);
