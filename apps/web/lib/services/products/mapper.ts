import { mapIdentity } from "@/lib/services/service-architecture";
import type { Product } from "@/lib/services/products/types";

export const mapProduct = mapIdentity<Product>;
