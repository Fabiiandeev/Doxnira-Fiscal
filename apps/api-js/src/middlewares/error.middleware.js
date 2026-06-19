import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export function errorMiddleware(error, request, response, _next) {
  const statusCode =
    Number.isInteger(error.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : 500;

  const code = error.code || "INTERNAL_ERROR";
  const message =
    statusCode >= 500 ? "Internal server error." : error.message;

  logger.error(
    {
      ...(env.NODE_ENV === "production"
        ? { error: { name: error.name, code } }
        : { err: error }),
      requestId: request.id,
      method: request.method,
      path: request.originalUrl,
      statusCode,
    },
    statusCode >= 500 ? "Request failed" : "Request rejected",
  );

  response.status(statusCode).json({
    error: true,
    message,
    code,
    details: error.details || [],
    requestId: request.id,
  });
}
