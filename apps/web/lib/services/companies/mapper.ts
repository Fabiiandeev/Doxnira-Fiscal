import { mapIdentity } from "@/lib/services/service-architecture";
import type { Company } from "@/lib/services/companies/types";

export const mapCompany = mapIdentity<Company>;
