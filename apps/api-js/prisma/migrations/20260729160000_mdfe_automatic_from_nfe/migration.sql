BEGIN;

CREATE TYPE "MdfeNfeEligibilityStatus" AS ENUM (
  'PENDING_EVALUATION',
  'ELIGIBLE',
  'INELIGIBLE',
  'RESERVED',
  'LINKED_TO_DRAFT',
  'LINKED_TO_ACTIVE_MDFE',
  'COMPLETED',
  'RELEASED'
);

CREATE TYPE "MdfeNfeReservationStatus" AS ENUM (
  'AVAILABLE',
  'RESERVED',
  'LINKED_TO_DRAFT',
  'LINKED_TO_ACTIVE_MDFE',
  'RELEASED',
  'COMPLETED'
);

ALTER TABLE "mdfe_drafts"
  ADD COLUMN "automatic_preparation_key" VARCHAR(120),
  ADD COLUMN "predominant_product_metadata" JSONB,
  ADD COLUMN "route_confidence" VARCHAR(20),
  ADD COLUMN "route_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "route_source" VARCHAR(80),
  ADD COLUMN "total_net_weight_kg" DECIMAL(15,3) NOT NULL DEFAULT 0,
  ADD COLUMN "total_package_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0;

ALTER TABLE "mdfe_fiscal_document_links"
  ADD COLUMN "nfe_document_id" UUID;

ALTER TABLE "mdfe_fiscal_document_links"
  DROP CONSTRAINT IF EXISTS "mdfe_fiscal_document_links_source_consistency_check",
  ADD CONSTRAINT "mdfe_fiscal_document_links_source_consistency_check" CHECK (
    (("nfe_entry_id" IS NOT NULL)::int
      + ("nfe_document_id" IS NOT NULL)::int
      + ("cte_entry_id" IS NOT NULL)::int) <= 1
    AND ("nfe_entry_id" IS NULL OR "document_type" = 'NFE')
    AND ("nfe_document_id" IS NULL OR "document_type" = 'NFE')
    AND ("cte_entry_id" IS NULL OR "document_type" = 'CTE')
  );

CREATE TABLE "mdfe_nfe_eligibilities" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "nfe_document_id" UUID NOT NULL,
  "status" "MdfeNfeEligibilityStatus" NOT NULL DEFAULT 'PENDING_EVALUATION',
  "reason_code" VARCHAR(80),
  "reason_message" VARCHAR(500),
  "establishment_key" VARCHAR(120),
  "loading_city_code" VARCHAR(7),
  "loading_city_name" VARCHAR(120),
  "loading_state" CHAR(2),
  "destination_city_code" VARCHAR(7),
  "destination_city_name" VARCHAR(120),
  "destination_state" CHAR(2),
  "cargo_ownership_type" VARCHAR(30) NOT NULL DEFAULT 'OWN_CARGO',
  "issuer_type" VARCHAR(30) NOT NULL DEFAULT 'CARGA_PROPRIA',
  "transport_mode" VARCHAR(30) NOT NULL DEFAULT 'RODOVIARIO',
  "contractor_id" UUID,
  "evaluated_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mdfe_nfe_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mdfe_nfe_eligibility_history" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "eligibility_id" UUID NOT NULL,
  "previous_status" "MdfeNfeEligibilityStatus",
  "next_status" "MdfeNfeEligibilityStatus" NOT NULL,
  "reason_code" VARCHAR(80),
  "reason_message" VARCHAR(500),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mdfe_nfe_eligibility_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mdfe_nfe_reservations" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "nfe_document_id" UUID NOT NULL,
  "mdfe_draft_id" UUID,
  "user_id" UUID NOT NULL,
  "status" "MdfeNfeReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "idempotency_key" VARCHAR(120) NOT NULL,
  "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "released_at" TIMESTAMP(3),
  "release_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mdfe_nfe_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mdfe_drafts_company_id_automatic_preparation_key_key"
  ON "mdfe_drafts"("company_id", "automatic_preparation_key");
CREATE INDEX "mdfe_fiscal_document_links_nfe_document_id_idx"
  ON "mdfe_fiscal_document_links"("nfe_document_id");
CREATE UNIQUE INDEX "mdfe_nfe_eligibilities_nfe_document_id_key"
  ON "mdfe_nfe_eligibilities"("nfe_document_id");
CREATE INDEX "mdfe_nfe_eligibilities_company_id_status_destination_state_idx"
  ON "mdfe_nfe_eligibilities"("company_id", "status", "destination_state");
CREATE INDEX "mdfe_nfe_eligibilities_company_id_establishment_key_status_idx"
  ON "mdfe_nfe_eligibilities"("company_id", "establishment_key", "status");
CREATE INDEX "mdfe_nfe_eligibilities_company_id_evaluated_at_idx"
  ON "mdfe_nfe_eligibilities"("company_id", "evaluated_at" DESC);
CREATE INDEX "mdfe_nfe_eligibility_history_company_id_created_at_idx"
  ON "mdfe_nfe_eligibility_history"("company_id", "created_at" DESC);
CREATE INDEX "mdfe_nfe_eligibility_history_eligibility_id_created_at_idx"
  ON "mdfe_nfe_eligibility_history"("eligibility_id", "created_at" DESC);
CREATE UNIQUE INDEX "mdfe_nfe_reservations_nfe_document_id_key"
  ON "mdfe_nfe_reservations"("nfe_document_id");
CREATE INDEX "mdfe_nfe_reservations_company_id_status_expires_at_idx"
  ON "mdfe_nfe_reservations"("company_id", "status", "expires_at");
CREATE INDEX "mdfe_nfe_reservations_mdfe_draft_id_status_idx"
  ON "mdfe_nfe_reservations"("mdfe_draft_id", "status");
CREATE UNIQUE INDEX "mdfe_nfe_reservations_company_id_idempotency_key_nfe_docume_key"
  ON "mdfe_nfe_reservations"("company_id", "idempotency_key", "nfe_document_id");

ALTER TABLE "mdfe_fiscal_document_links"
  ADD CONSTRAINT "mdfe_fiscal_document_links_nfe_document_id_fkey"
  FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_eligibilities"
  ADD CONSTRAINT "mdfe_nfe_eligibilities_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_eligibilities"
  ADD CONSTRAINT "mdfe_nfe_eligibilities_nfe_document_id_fkey"
  FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_eligibility_history"
  ADD CONSTRAINT "mdfe_nfe_eligibility_history_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_eligibility_history"
  ADD CONSTRAINT "mdfe_nfe_eligibility_history_eligibility_id_fkey"
  FOREIGN KEY ("eligibility_id") REFERENCES "mdfe_nfe_eligibilities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_reservations"
  ADD CONSTRAINT "mdfe_nfe_reservations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_reservations"
  ADD CONSTRAINT "mdfe_nfe_reservations_nfe_document_id_fkey"
  FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_reservations"
  ADD CONSTRAINT "mdfe_nfe_reservations_mdfe_draft_id_fkey"
  FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_reservations"
  ADD CONSTRAINT "mdfe_nfe_reservations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mdfe_nfe_eligibilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mdfe_nfe_eligibility_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mdfe_nfe_reservations" ENABLE ROW LEVEL SECURITY;

COMMIT;
