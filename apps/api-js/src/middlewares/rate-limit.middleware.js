import { AppError } from "../utils/app-error.js";

const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60, key = "global" } = {}) {
  return (request, _response, next) => {
    const identity = `${key}:${request.ip}:${request.user?.id || "anonymous"}`;
    const now = Date.now();
    const bucket = buckets.get(identity);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(identity, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return next(
        new AppError(
          "Limite de requisições excedido. Tente novamente em instantes.",
          "RATE_LIMITED",
          429,
        ),
      );
    }
    next();
  };
}
