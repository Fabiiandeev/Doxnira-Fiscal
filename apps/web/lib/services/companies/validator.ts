import { createValidationResult } from "@/lib/services/service-architecture";
import type { Company } from "@/lib/services/companies/types";

export function validateCompanyDraft(company: Partial<Company>) {
  void company;
  return createValidationResult();
}
