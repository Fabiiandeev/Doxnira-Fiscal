import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/response.js";

export const requireAuth = asyncHandler(async (request, _response, next) => {
  const authorization = request.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Autenticação necessária.", "AUTH_REQUIRED", 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError("Sessão inválida ou expirada.", "INVALID_TOKEN", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError("Usuário não encontrado.", "USER_NOT_FOUND", 401);
  }

  request.user = user;
  next();
});
