BEGIN;
CREATE TABLE "fiscal_exports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "office_id" UUID NOT NULL,
  "preparation_id" UUID NOT NULL REFERENCES "fiscal_book_preparations"("id") ON DELETE RESTRICT,
  "closing_id" UUID NOT NULL REFERENCES "monthly_tax_closings"("id") ON DELETE RESTRICT,
  "type" VARCHAR(30) NOT NULL,
  "period_year" INTEGER NOT NULL,
  "period_month" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
  "layout_version" VARCHAR(40) NOT NULL,
  "snapshot_hash" VARCHAR(64) NOT NULL,
  "content_hash" VARCHAR(64) NOT NULL,
  "file_name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "generated_by_user_id" UUID,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_json" JSONB,
  UNIQUE("preparation_id", "type", "layout_version", "snapshot_hash")
);
CREATE INDEX "fiscal_exports_company_office_period_generated_idx" ON "fiscal_exports"("company_id", "office_id", "period_year", "period_month", "generated_at");
CREATE INDEX "fiscal_exports_company_preparation_idx" ON "fiscal_exports"("company_id", "preparation_id");
COMMIT;
