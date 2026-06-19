-- AlterTable
ALTER TABLE "alerts" ADD COLUMN "read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "digital_certificates"
ADD COLUMN "holder_cnpj" VARCHAR(14),
ADD COLUMN "validated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fiscal_documents"
ADD COLUMN "cfop" VARCHAR(10),
ADD COLUMN "invoice_number" VARCHAR(30),
ADD COLUMN "is_new_supplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manifestation_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
ADD COLUMN "model" VARCHAR(10),
ADD COLUMN "products" JSONB,
ADD COLUMN "protocol" VARCHAR(80),
ADD COLUMN "series" VARCHAR(10),
ADD COLUMN "taxes" JSONB,
ADD COLUMN "uf" CHAR(2);

-- AlterTable
ALTER TABLE "sync_logs" ADD COLUMN "job_id" VARCHAR(120);

-- CreateIndex
CREATE INDEX "fiscal_documents_recipient_cnpj_idx"
ON "fiscal_documents"("recipient_cnpj");

-- CreateIndex
CREATE INDEX "fiscal_documents_company_id_nsu_idx"
ON "fiscal_documents"("company_id", "nsu");

-- CreateIndex
CREATE INDEX "fiscal_documents_company_id_is_summary_idx"
ON "fiscal_documents"("company_id", "is_summary");

-- CreateIndex
CREATE INDEX "fiscal_documents_company_id_is_cancelled_idx"
ON "fiscal_documents"("company_id", "is_cancelled");

-- CreateIndex
CREATE INDEX "fiscal_documents_company_id_created_at_idx"
ON "fiscal_documents"("company_id", "created_at" DESC);
