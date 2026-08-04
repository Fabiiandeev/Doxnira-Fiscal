import { logger } from "../config/logger.js";

export function errorMiddleware(error, request, response, _next) {
  const isZodError = error?.name === "ZodError" || Array.isArray(error?.issues);
  const statusCode =
    Number.isInteger(error.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : isZodError
        ? 422
        : 500;

  const code = error.code || (isZodError ? "VALIDATION_ERROR" : "INTERNAL_ERROR");
  const message =
    statusCode >= 500
      ? "Internal server error."
      : isZodError
        ? "Dados inválidos para a operação solicitada."
        : error.message;

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
    details: error.details || (isZodError ? { issues: error.issues || [] } : {}),
    requestId: request.id,
  });
}
