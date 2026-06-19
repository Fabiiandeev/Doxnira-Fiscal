import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export async function executeRealCteSync() {
  if (!env.CTE_INTEGRATION_ENABLED) {
    throw new AppError(
      "Integração real com CT-e desativada por configuração.",
      "CTE_INTEGRATION_DISABLED",
      409,
    );
  }
  if (env.SEFAZ_ENVIRONMENT === "production" && !env.ALLOW_PRODUCTION_SEFAZ) {
    throw new AppError(
      "Ambiente de produção SEFAZ bloqueado.",
      "PRODUCTION_SEFAZ_BLOCKED",
      409,
    );
  }
  const endpoint =
    env.SEFAZ_ENVIRONMENT === "production"
      ? env.CTE_DIST_DFE_PROD_URL
      : env.CTE_DIST_DFE_HOM_URL;
  if (!endpoint) {
    throw new AppError(
      "Endpoint de distribuição CT-e não configurado.",
      "CTE_ENDPOINT_NOT_CONFIGURED",
      409,
    );
  }
  throw new AppError(
    "Endpoint CT-e configurado, mas o provedor deve ser homologado antes do envio.",
    "CTE_PROVIDER_NOT_HOMOLOGATED",
    501,
  );
}
