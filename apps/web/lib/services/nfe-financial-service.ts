import { generateNfeFinancial } from "@/lib/services/nfe-service";

export const nfeFinancialService = {
  generateReceivables: generateNfeFinancial,
};
