CREATE TYPE "AllocationStatus" AS ENUM ('NOT_ALLOCATED', 'PENDING_CONFIGURATION', 'CALCULATED', 'CONFIRMED', 'APPLIED', 'BLOCKED');
CREATE TYPE "AllocationMethod" AS ENUM ('VALUE', 'QUANTITY', 'WEIGHT', 'VOLUME', 'MANUAL');

CREATE TABLE "cte_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "cte_entry_id" UUID NOT NULL,
  "method" "AllocationMethod" NOT NULL,
  "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING_CONFIGURATION',
  "service_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "allocatable_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "allocated_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "residual_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "configuration" JSONB,
  "calculation_hash" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID,
  "confirmed_by" UUID,
  "confirmed_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cte_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cte_allocations_cte_entry_id_calculation_hash_key" UNIQUE ("cte_entry_id", "calculation_hash")
);

CREATE TABLE "cte_allocation_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "allocation_id" UUID NOT NULL,
  "cte_entry_nfe_link_id" UUID NOT NULL,
  "nfe_entry_id" UUID,
  "calculation_base" DECIMAL(18,6) NOT NULL,
  "percentage" DECIMAL(12,6) NOT NULL,
  "calculated_value" DECIMAL(15,2) NOT NULL,
  "residual_adjustment" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "allocated_value" DECIMAL(15,2) NOT NULL,
  "source" VARCHAR(30) NOT NULL DEFAULT 'CALCULATED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cte_allocation_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cte_allocation_documents_allocation_id_cte_entry_nfe_link_id_key" UNIQUE ("allocation_id", "cte_entry_nfe_link_id")
);

CREATE TABLE "cte_entry_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "company_id" UUID NOT NULL, "cte_entry_id" UUID NOT NULL,
  "user_id" UUID, "action" VARCHAR(80) NOT NULL, "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cte_entry_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cte_allocation_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "company_id" UUID NOT NULL,
  "allocation_document_id" UUID NOT NULL, "nfe_entry_item_id" UUID NOT NULL, "product_id" UUID,
  "calculation_base" DECIMAL(18,6) NOT NULL, "percentage" DECIMAL(12,6) NOT NULL,
  "allocated_value" DECIMAL(15,2) NOT NULL, "projected_unit_impact" DECIMAL(15,6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cte_allocation_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cte_allocation_items_allocation_document_id_nfe_entry_item_id_key" UNIQUE ("allocation_document_id", "nfe_entry_item_id")
);

CREATE INDEX "cte_allocations_company_id_idx" ON "cte_allocations"("company_id");
CREATE INDEX "cte_allocations_cte_entry_id_idx" ON "cte_allocations"("cte_entry_id");
CREATE INDEX "cte_allocations_status_idx" ON "cte_allocations"("status");
CREATE INDEX "cte_allocations_calculation_hash_idx" ON "cte_allocations"("calculation_hash");
CREATE INDEX "cte_allocations_confirmed_at_idx" ON "cte_allocations"("confirmed_at");
CREATE INDEX "cte_allocation_documents_company_id_idx" ON "cte_allocation_documents"("company_id");
CREATE INDEX "cte_allocation_documents_allocation_id_idx" ON "cte_allocation_documents"("allocation_id");
CREATE INDEX "cte_allocation_documents_nfe_entry_id_idx" ON "cte_allocation_documents"("nfe_entry_id");
CREATE INDEX "cte_entry_audit_logs_company_id_created_at_idx" ON "cte_entry_audit_logs"("company_id", "created_at" DESC);
CREATE INDEX "cte_entry_audit_logs_cte_entry_id_created_at_idx" ON "cte_entry_audit_logs"("cte_entry_id", "created_at" DESC);
CREATE INDEX "cte_allocation_items_company_id_idx" ON "cte_allocation_items"("company_id");
CREATE INDEX "cte_allocation_items_allocation_document_id_idx" ON "cte_allocation_items"("allocation_document_id");
CREATE INDEX "cte_allocation_items_nfe_entry_item_id_idx" ON "cte_allocation_items"("nfe_entry_item_id");
CREATE INDEX "cte_allocation_items_product_id_idx" ON "cte_allocation_items"("product_id");
CREATE UNIQUE INDEX "cte_allocations_one_confirmed_per_cte" ON "cte_allocations"("cte_entry_id") WHERE "status" = 'CONFIRMED';

ALTER TABLE "cte_allocations" ADD CONSTRAINT "cte_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_allocations" ADD CONSTRAINT "cte_allocations_cte_entry_id_fkey" FOREIGN KEY ("cte_entry_id") REFERENCES "cte_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cte_allocations" ADD CONSTRAINT "cte_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cte_allocations" ADD CONSTRAINT "cte_allocations_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_documents" ADD CONSTRAINT "cte_allocation_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_documents" ADD CONSTRAINT "cte_allocation_documents_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "cte_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_documents" ADD CONSTRAINT "cte_allocation_documents_cte_entry_nfe_link_id_fkey" FOREIGN KEY ("cte_entry_nfe_link_id") REFERENCES "cte_entry_nfe_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_documents" ADD CONSTRAINT "cte_allocation_documents_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_entry_audit_logs" ADD CONSTRAINT "cte_entry_audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_entry_audit_logs" ADD CONSTRAINT "cte_entry_audit_logs_cte_entry_id_fkey" FOREIGN KEY ("cte_entry_id") REFERENCES "cte_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_items" ADD CONSTRAINT "cte_allocation_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_items" ADD CONSTRAINT "cte_allocation_items_allocation_document_id_fkey" FOREIGN KEY ("allocation_document_id") REFERENCES "cte_allocation_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_items" ADD CONSTRAINT "cte_allocation_items_nfe_entry_item_id_fkey" FOREIGN KEY ("nfe_entry_item_id") REFERENCES "nfe_entry_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cte_allocation_items" ADD CONSTRAINT "cte_allocation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
