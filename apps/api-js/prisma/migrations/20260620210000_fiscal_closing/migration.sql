ALTER TABLE "fiscal_documents"
  ADD COLUMN "operation_direction" VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "company_role" VARCHAR(30) NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "products_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "freight_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "icms_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "ipi_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "pis_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "cofins_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "icms_base" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "icms_st_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "fcp_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "other_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "tax_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN "raw_xml_hash" VARCHAR(64);

UPDATE "fiscal_documents"
SET
  "operation_direction" = CASE
    WHEN "issuer_cnpj" = c."cnpj" THEN 'OUTBOUND'
    WHEN "recipient_cnpj" = c."cnpj" THEN 'INBOUND'
    ELSE 'UNKNOWN'
  END,
  "company_role" = CASE
    WHEN "issuer_cnpj" = c."cnpj" THEN 'ISSUER'
    WHEN "recipient_cnpj" = c."cnpj" THEN 'RECIPIENT'
    ELSE 'OTHER'
  END,
  "raw_xml_hash" = "xml_hash_sha256"
FROM "companies" c
WHERE "fiscal_documents"."company_id" = c."id";

CREATE INDEX "fiscal_documents_company_id_document_type_idx" ON "fiscal_documents"("company_id", "document_type");
CREATE INDEX "fiscal_documents_company_id_operation_direction_idx" ON "fiscal_documents"("company_id", "operation_direction");
CREATE INDEX "fiscal_documents_company_id_cfop_idx" ON "fiscal_documents"("company_id", "cfop");

CREATE TABLE "company_tax_settings" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tax_regime" VARCHAR(40) NOT NULL,
  "calculation_regime" VARCHAR(30) NOT NULL,
  "uf" CHAR(2) NOT NULL,
  "state_registration" VARCHAR(40),
  "main_cnae" VARCHAR(20),
  "simples_annex" VARCHAR(20),
  "main_activity" VARCHAR(255),
  "is_icms_taxpayer" BOOLEAN NOT NULL DEFAULT false,
  "is_ipi_taxpayer" BOOLEAN NOT NULL DEFAULT false,
  "pis_cofins_regime" VARCHAR(30) NOT NULL,
  "accumulated_revenue" DECIMAL(15,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_tax_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_tax_settings_company_id_key" UNIQUE ("company_id"),
  CONSTRAINT "company_tax_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "fiscal_document_items" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "item_number" INTEGER NOT NULL,
  "product_code" VARCHAR(80),
  "ean" VARCHAR(30),
  "description" VARCHAR(255),
  "ncm" VARCHAR(20),
  "cfop" VARCHAR(10),
  "cst" VARCHAR(10),
  "csosn" VARCHAR(10),
  "quantity" DECIMAL(15,4),
  "unit" VARCHAR(10),
  "unit_value" DECIMAL(15,4),
  "total_value" DECIMAL(15,2),
  "discount_value" DECIMAL(15,2) DEFAULT 0,
  "icms_base" DECIMAL(15,2) DEFAULT 0,
  "icms_rate" DECIMAL(8,4) DEFAULT 0,
  "icms_amount" DECIMAL(15,2) DEFAULT 0,
  "ipi_base" DECIMAL(15,2) DEFAULT 0,
  "ipi_rate" DECIMAL(8,4) DEFAULT 0,
  "ipi_amount" DECIMAL(15,2) DEFAULT 0,
  "pis_base" DECIMAL(15,2) DEFAULT 0,
  "pis_rate" DECIMAL(8,4) DEFAULT 0,
  "pis_amount" DECIMAL(15,2) DEFAULT 0,
  "cofins_base" DECIMAL(15,2) DEFAULT 0,
  "cofins_rate" DECIMAL(8,4) DEFAULT 0,
  "cofins_amount" DECIMAL(15,2) DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_document_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_document_items_document_id_item_number_key" UNIQUE ("document_id", "item_number"),
  CONSTRAINT "fiscal_document_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "fiscal_document_items_company_id_idx" ON "fiscal_document_items"("company_id");
CREATE INDEX "fiscal_document_items_document_id_idx" ON "fiscal_document_items"("document_id");
CREATE INDEX "fiscal_document_items_cfop_idx" ON "fiscal_document_items"("cfop");
CREATE INDEX "fiscal_document_items_ncm_idx" ON "fiscal_document_items"("ncm");

CREATE TABLE "monthly_tax_closings" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "period_year" INTEGER NOT NULL,
  "period_month" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "inbound_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "outbound_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "freight_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "icms_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "ipi_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "pis_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cofins_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "estimated_tax_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "included_documents" INTEGER NOT NULL DEFAULT 0,
  "ignored_documents" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_tax_closings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_tax_closings_company_period_key" UNIQUE ("company_id", "period_year", "period_month"),
  CONSTRAINT "monthly_tax_closings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "monthly_tax_closings_company_period_idx" ON "monthly_tax_closings"("company_id", "period_year", "period_month");
CREATE INDEX "monthly_tax_closings_status_idx" ON "monthly_tax_closings"("status");

CREATE TABLE "monthly_tax_closing_items" (
  "id" UUID NOT NULL,
  "closing_id" UUID NOT NULL,
  "document_id" UUID,
  "category" VARCHAR(30) NOT NULL,
  "source" VARCHAR(30) NOT NULL,
  "access_key" VARCHAR(44),
  "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_tax_closing_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_tax_closing_items_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_tax_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monthly_tax_closing_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "fiscal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "monthly_tax_closing_items_closing_category_idx" ON "monthly_tax_closing_items"("closing_id", "category");
CREATE INDEX "monthly_tax_closing_items_document_id_idx" ON "monthly_tax_closing_items"("document_id");

CREATE TABLE "monthly_tax_closing_warnings" (
  "id" UUID NOT NULL,
  "closing_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_tax_closing_warnings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_tax_closing_warnings_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_tax_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "monthly_tax_closing_warnings_closing_severity_idx" ON "monthly_tax_closing_warnings"("closing_id", "severity");

CREATE TABLE "tax_rules" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tax_regime" VARCHAR(40) NOT NULL,
  "uf" CHAR(2),
  "cfop" VARCHAR(10),
  "ncm" VARCHAR(20),
  "cst" VARCHAR(10),
  "csosn" VARCHAR(10),
  "tax_type" VARCHAR(30) NOT NULL,
  "operation_direction" VARCHAR(30),
  "rate" DECIMAL(8,4) NOT NULL,
  "credit_allowed" BOOLEAN NOT NULL DEFAULT false,
  "debit_allowed" BOOLEAN NOT NULL DEFAULT false,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "tax_rules_company_tax_type_idx" ON "tax_rules"("company_id", "tax_type");
CREATE INDEX "tax_rules_company_cfop_ncm_idx" ON "tax_rules"("company_id", "cfop", "ncm");
CREATE INDEX "tax_rules_effective_period_idx" ON "tax_rules"("effective_from", "effective_until");
