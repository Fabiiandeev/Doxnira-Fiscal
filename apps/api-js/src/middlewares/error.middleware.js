import { logger } from "../config/logger.js";

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
      error: { name: error.name, code, cause: error.cause, field: error.field },
      requestId: request.id,
      method: request.method,
      path: request.originalUrl,
      statusCode,
    },
    statusCode >= 500 ? "Request failed" : "Request rejected",
  );

  response.status(statusCode).json({
    code,
    message,
    cause: error.cause || null,
    field: error.field || null,
    suggestion: error.suggestion || null,
    autoFix: error.autoFix || { available: false, action: null, label: null },
    details: error.details || {},
    requestId: request.id,
  });
}
