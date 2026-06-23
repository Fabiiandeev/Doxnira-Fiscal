ALTER TABLE "fiscal_documents"
ADD COLUMN "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL_IMPORT';

UPDATE "fiscal_documents"
SET "source" = CASE
  WHEN "xml_storage_key" LIKE 'sefaz/%' THEN 'REAL_SEFAZ'
  WHEN "xml_storage_key" LIKE 'mock/%' THEN 'MOCK'
  WHEN "xml_storage_key" LIKE 'seed/%' THEN 'SEED'
  ELSE 'MANUAL_IMPORT'
END;

CREATE INDEX "fiscal_documents_company_id_source_idx"
ON "fiscal_documents"("company_id", "source");

ALTER TABLE "sync_logs"
ADD COLUMN "documents_received" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "documents_saved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mode" VARCHAR(20) NOT NULL DEFAULT 'mock',
ADD COLUMN "environment" VARCHAR(20);
