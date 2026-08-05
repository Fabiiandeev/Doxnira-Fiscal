BEGIN;

ALTER TABLE "payables"
  ADD COLUMN "source_type" VARCHAR(40),
  ADD COLUMN "source_id" UUID;

UPDATE "payables"
SET
  "source_type" = 'NFE_ENTRY',
  "source_id" = "nfe_entry_id"
WHERE "nfe_entry_id" IS NOT NULL;

ALTER TABLE "payables"
  ADD CONSTRAINT "payables_source_pair_check"
  CHECK (("source_type" IS NULL) = ("source_id" IS NULL));

CREATE UNIQUE INDEX "payables_company_id_source_type_source_id_installment_number_key"
  ON "payables"("company_id", "source_type", "source_id", "installment_number");

COMMIT;
