import { env } from "../config/env.js";
import { importMockCte } from "./mock-cte.service.js";
import { executeRealCteSync } from "./cte-real.service.js";

export function executeCteSync(input) {
  return env.CTE_INTEGRATION_ENABLED
    ? executeRealCteSync(input)
    : importMockCte(input.companyId, input.nfeKeys);
}
