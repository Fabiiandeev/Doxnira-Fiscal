import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/response.js";
import { isSessionRevoked, sessionTokenFromRequest } from "../modules/auth/session.service.js";
import { csrfProtection } from "./csrf.middleware.js";

async function authenticate(request, response, next, required) {
  const { token, transport } = sessionTokenFromRequest(request);
  if (!token) {
    if (!required) return next();
    throw new AppError("Autenticação necessária.", "AUTH_REQUIRED", 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError("Sessão inválida ou expirada.", "INVALID_TOKEN", 401);
  }
  if (await isSessionRevoked(payload)) throw new AppError("Sessão revogada.", "SESSION_REVOKED", 401);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new AppError("Usuário não encontrado.", "USER_NOT_FOUND", 401);

  request.user = user;
  request.auth = { payload, transport };
  return csrfProtection(request, response, next);
}

export const requireAuth = asyncHandler((request, response, next) => authenticate(request, response, next, true));
export const optionalAuth = asyncHandler((request, response, next) => authenticate(request, response, next, false));
