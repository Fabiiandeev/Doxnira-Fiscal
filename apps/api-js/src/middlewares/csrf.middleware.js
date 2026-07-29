import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { csrfMatches } from "../modules/auth/session.service.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const exemptPaths = [
  "/api/auth/login", "/api/auth/register", "/api/health",
  "/api/marketplaces/shopee/callback", "/api/commerce/marketplaces/mercado-livre/callback",
  "/api/webhooks/",
];

export function csrfProtection(request, _response, next) {
  if (safeMethods.has(request.method) || exemptPaths.some((path) => request.path === path || request.path.startsWith(path))) return next();
  if (request.auth?.transport !== "cookie") return next();
  const origin = request.get("origin");
  const referer = request.get("referer");
  const allowed = env.CORS_ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean);
  const source = origin || (referer ? new URL(referer).origin : null);
  if (!source || !allowed.includes(source)) return next(new AppError("Origem da requisição não autorizada.", "CSRF_ORIGIN_REJECTED", 403));
  if (!csrfMatches(request.auth.payload, request.get("x-csrf-token"))) return next(new AppError("Token CSRF inválido ou ausente.", "CSRF_TOKEN_INVALID", 403));
  return next();
}
