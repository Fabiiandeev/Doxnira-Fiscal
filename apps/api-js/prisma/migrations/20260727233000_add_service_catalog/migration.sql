CREATE TABLE "service_catalog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "municipal_code" VARCHAR(40) NOT NULL,
  "national_code" VARCHAR(40) NOT NULL,
  "service_list_item" VARCHAR(40),
  "municipality" VARCHAR(120) NOT NULL,
  "municipality_ibge_code" VARCHAR(7) NOT NULL,
  "cnae" VARCHAR(10),
  "iss_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "iss_withheld" BOOLEAN NOT NULL DEFAULT false,
  "operation_nature" VARCHAR(80),
  "enforceability" VARCHAR(80),
  "incidence_location" VARCHAR(120),
  "inss_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "ir_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "csll_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "pis_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "cofins_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "other_withholding_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "default_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_catalog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "service_catalog_company_id_code_key" ON "service_catalog"("company_id", "code");
CREATE UNIQUE INDEX "service_catalog_company_id_municipal_code_municipality_ibge_code_key" ON "service_catalog"("company_id", "municipal_code", "municipality_ibge_code");
CREATE INDEX "service_catalog_company_id_active_description_idx" ON "service_catalog"("company_id", "active", "description");
