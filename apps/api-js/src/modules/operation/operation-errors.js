import { AppError } from "../../utils/app-error.js";

export const operationNotFound = (entity) =>
  new AppError(`${entity} não encontrado neste contexto.`, "OPERATION_NOT_FOUND", 404);
export const viewerForbidden = () =>
  new AppError("Usuário VIEWER possui acesso somente para consulta.", "FORBIDDEN", 403);
export const inventoryConflict = (message, code = "INVENTORY_CONFLICT") =>
  new AppError(message, code, 409);
export const inventoryValidation = (message) =>
  new AppError(message, "INVENTORY_VALIDATION_ERROR", 400);
