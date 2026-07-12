import { createValidationResult } from "@/lib/services/service-architecture";
import type { Product } from "@/lib/services/products/types";

export function validateProductDraft(product: Partial<Product>) {
  void product;
  return createValidationResult();
}
