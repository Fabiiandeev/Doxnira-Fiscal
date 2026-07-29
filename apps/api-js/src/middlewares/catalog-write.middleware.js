import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

export function protectCatalogWrites(entityType) {
  return (request, response, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.user?.role === "VIEWER") {
      return next(new AppError("Usuário VIEWER possui acesso somente para consulta.", "FORBIDDEN", 403));
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      response.once("finish", () => {
        if (response.statusCode >= 400 || !request.company?.id) return;
        prisma.auditLog.create({
          data: {
            companyId: request.company.id, userId: request.user?.id || null,
            action: `${entityType}_${request.method}`, entityType,
            entityId: /^[0-9a-f-]{36}$/i.test(request.params.id || "") ? request.params.id : null,
            ipAddress: request.ip, userAgent: request.get("user-agent") || null,
            metadata: { path: request.originalUrl, statusCode: response.statusCode },
          },
        }).catch(() => {});
      });
    }
    next();
  };
}
