import { env } from "../config/env.js";
import { executeMockSefazSync } from "./mock-sefaz.service.js";
import { executeRealSefazSync } from "./sefaz-real.service.js";

export async function executeSefazSync(input) {
  if (env.SEFAZ_INTEGRATION_ENABLED) {
    return executeRealSefazSync(input);
  }
  return executeMockSefazSync(input);
}
