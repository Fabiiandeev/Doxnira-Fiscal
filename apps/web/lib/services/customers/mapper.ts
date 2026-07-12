import { mapIdentity } from "@/lib/services/service-architecture";
import type { IntelligentClient } from "@/lib/services/customers/types";

export const mapCustomer = mapIdentity<IntelligentClient>;
