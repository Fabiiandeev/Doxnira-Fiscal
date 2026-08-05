BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payables"
    WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL
    GROUP BY "company_id", "source_type", "source_id", "installment_number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate payable origins prevent source uniqueness';
  END IF;
END $$;

DROP INDEX "payables_company_id_source_type_source_id_installment_number_key";

CREATE UNIQUE INDEX "payables_company_id_source_type_source_id_installment_number_key"
  ON "payables"("company_id", "source_type", "source_id", "installment_number")
  WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL;

COMMIT;
