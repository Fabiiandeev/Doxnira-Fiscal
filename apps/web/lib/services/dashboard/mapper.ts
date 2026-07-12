import { mapIdentity } from "@/lib/services/service-architecture";
import type { PortfolioDashboard } from "@/lib/services/dashboard/types";

export const mapPortfolioDashboard = mapIdentity<PortfolioDashboard>;
