import { mapIdentity } from "@/lib/services/service-architecture";
import type { FiscalDocument } from "@/lib/services/fiscal/types";

export const mapFiscalDocument = mapIdentity<FiscalDocument>;
