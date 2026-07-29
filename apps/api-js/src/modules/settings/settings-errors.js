import { AppError } from "../../utils/app-error.js";
export const settingsErrors = {
  writeForbidden: () => new AppError("VIEWER possui acesso somente leitura.", "SETTINGS_WRITE_FORBIDDEN", 403),
  confirmationRequired: () => new AppError("Confirmação explícita é obrigatória para alteração crítica.", "SETTINGS_CONFIRMATION_REQUIRED", 422),
  integrationMissing: () => new AppError("Integração não configurada.", "INTEGRATION_CONFIGURATION_REQUIRED", 409),
};
