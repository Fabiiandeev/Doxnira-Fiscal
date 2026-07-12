import { createValidationResult } from "@/lib/services/service-architecture";
import type { IntelligentClient } from "@/lib/services/customers/types";

export function validateCustomerDraft(customer: Partial<IntelligentClient>) {
  void customer;
  return createValidationResult();
}
