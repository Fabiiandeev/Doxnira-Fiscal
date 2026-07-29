ALTER TABLE "fiscal_exports" ALTER COLUMN "office_id" DROP NOT NULL;

CREATE TABLE "tax_guides" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "closing_id" UUID,
  "tax_type" VARCHAR(30) NOT NULL,
  "reference" VARCHAR(20) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "digit_line" TEXT,
  "barcode" TEXT,
  "attachment_url" TEXT,
  "notes" TEXT,
  "payment_date" TIMESTAMP(3),
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tax_guides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_guides_company_id_status_due_date_idx" ON "tax_guides"("company_id", "status", "due_date");
CREATE INDEX "tax_guides_company_id_reference_idx" ON "tax_guides"("company_id", "reference");
