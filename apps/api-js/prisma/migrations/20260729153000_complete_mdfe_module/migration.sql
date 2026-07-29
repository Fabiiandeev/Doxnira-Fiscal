BEGIN;

-- AlterEnum
CREATE TYPE "MdfeStatus_new" AS ENUM ('DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'READY_TO_AUTHORIZE', 'SIGNING', 'SIGNED', 'AUTHORIZING', 'AUTHORIZED', 'IN_TRANSIT', 'REJECTED', 'DENIED', 'CANCELLING', 'CANCELLED', 'CLOSING', 'CLOSED', 'CONTINGENCY', 'ERROR');
ALTER TABLE "mdfe_drafts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "mdfe_drafts" ALTER COLUMN "status" TYPE "MdfeStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING_VALIDATION' THEN 'VALIDATING'
    WHEN 'VALIDATED' THEN 'READY_TO_AUTHORIZE'
    WHEN 'READY_TO_TRANSMIT' THEN 'READY_TO_AUTHORIZE'
    WHEN 'PROCESSING' THEN 'AUTHORIZING'
    ELSE "status"::text
  END::"MdfeStatus_new"
);
ALTER TABLE "mdfe_events" ALTER COLUMN "previous_status" TYPE "MdfeStatus_new" USING (
  CASE "previous_status"::text
    WHEN 'PENDING_VALIDATION' THEN 'VALIDATING'
    WHEN 'VALIDATED' THEN 'READY_TO_AUTHORIZE'
    WHEN 'READY_TO_TRANSMIT' THEN 'READY_TO_AUTHORIZE'
    WHEN 'PROCESSING' THEN 'AUTHORIZING'
    ELSE "previous_status"::text
  END::"MdfeStatus_new"
);
ALTER TABLE "mdfe_events" ALTER COLUMN "new_status" TYPE "MdfeStatus_new" USING (
  CASE "new_status"::text
    WHEN 'PENDING_VALIDATION' THEN 'VALIDATING'
    WHEN 'VALIDATED' THEN 'READY_TO_AUTHORIZE'
    WHEN 'READY_TO_TRANSMIT' THEN 'READY_TO_AUTHORIZE'
    WHEN 'PROCESSING' THEN 'AUTHORIZING'
    ELSE "new_status"::text
  END::"MdfeStatus_new"
);
ALTER TYPE "MdfeStatus" RENAME TO "MdfeStatus_old";
ALTER TYPE "MdfeStatus_new" RENAME TO "MdfeStatus";
DROP TYPE "MdfeStatus_old";
ALTER TABLE "mdfe_drafts" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- DropIndex
DROP INDEX "mdfe_insurances_mdfe_draft_id_key";

-- AlterTable
ALTER TABLE "mdfe_drafts" ADD COLUMN     "access_key" VARCHAR(44),
ADD COLUMN     "authorized_at" TIMESTAMP(3),
ADD COLUMN     "cargo_quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
ADD COLUMN     "cargo_unit" VARCHAR(2) NOT NULL DEFAULT '01',
ADD COLUMN     "check_digit" CHAR(1),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "internal_info" TEXT,
ADD COLUMN     "internal_reference" VARCHAR(160),
ADD COLUMN     "loading_after" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loading_cep" VARCHAR(8),
ADD COLUMN     "modal" VARCHAR(30) NOT NULL DEFAULT 'RODOVIARIO',
ADD COLUMN     "numeric_code" CHAR(8),
ADD COLUMN     "predominant_cargo_type" VARCHAR(10),
ADD COLUMN     "predominant_ncm" VARCHAR(8),
ADD COLUMN     "predominant_product" VARCHAR(255),
ADD COLUMN     "process_version" VARCHAR(60) NOT NULL DEFAULT 'DoxniraFiscal-1.0',
ADD COLUMN     "protocol" VARCHAR(80),
ADD COLUMN     "status_code" VARCHAR(10),
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "total_cargo_cents" DECIMAL(20,0) NOT NULL DEFAULT 0,
ADD COLUMN     "total_weight_kg" DECIMAL(15,3) NOT NULL DEFAULT 0,
ADD COLUMN     "trip_start_at" TIMESTAMP(3),
ADD COLUMN     "unloading_cep" VARCHAR(8);

-- AlterTable
ALTER TABLE "mdfe_drivers" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" VARCHAR(20);

-- AlterTable
ALTER TABLE "mdfe_fiscal_document_links" ADD COLUMN     "unloading_city_id" UUID;

-- Replace the foundation-only source constraint. Manual keys and imported XMLs
-- are valid sources, while linked entries must still match their document type.
ALTER TABLE "mdfe_fiscal_document_links"
  DROP CONSTRAINT IF EXISTS "mdfe_fiscal_document_links_exactly_one_source_check",
  DROP CONSTRAINT IF EXISTS "mdfe_fiscal_document_links_document_type_source_check",
  ADD CONSTRAINT "mdfe_fiscal_document_links_source_consistency_check" CHECK (
    NOT ("nfe_entry_id" IS NOT NULL AND "cte_entry_id" IS NOT NULL)
    AND ("nfe_entry_id" IS NULL OR "document_type" = 'NFE')
    AND ("cte_entry_id" IS NULL OR "document_type" = 'CTE')
  );

-- AlterTable
ALTER TABLE "mdfe_insurances" ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "mdfe_events" ADD COLUMN     "event_sequence" INTEGER,
ADD COLUMN     "idempotency_key" VARCHAR(120),
ADD COLUMN     "protocol" VARCHAR(80),
ADD COLUMN     "response_reason" TEXT,
ADD COLUMN     "status_code" VARCHAR(10),
ADD COLUMN     "xml_artifact_id" UUID;

-- CreateTable
CREATE TABLE "mdfe_loading_municipalities" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "city_code" VARCHAR(7) NOT NULL,
    "city_name" VARCHAR(120) NOT NULL,
    "expected_at" TIMESTAMP(3),
    "internal_note" TEXT,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_loading_municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_trailers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "plate" VARCHAR(7) NOT NULL,
    "plate_state" CHAR(2),
    "renavam" VARCHAR(20),
    "rntrc" VARCHAR(20),
    "tare_weight" DECIMAL(15,3),
    "capacity_kg" DECIMAL(15,3),
    "capacity_m3" DECIMAL(15,3),
    "body_type" VARCHAR(30),
    "owner_type" VARCHAR(30),
    "owner_name" VARCHAR(255),
    "owner_cpf_cnpj" VARCHAR(20),
    "owner_state_registration" VARCHAR(40),
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_trailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_contractors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255),
    "role" VARCHAR(40),
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_ciots" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "contractor_id" UUID,
    "number" VARCHAR(20) NOT NULL,
    "responsible_tax_id" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30),
    "internal_note" TEXT,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_ciots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_toll_vouchers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "provider_name" VARCHAR(255),
    "provider_cnpj" VARCHAR(20) NOT NULL,
    "purchase_number" VARCHAR(80) NOT NULL,
    "amount_cents" DECIMAL(20,0) NOT NULL,
    "payment_device" VARCHAR(80),
    "category" VARCHAR(30),
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_toll_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "contractor_id" UUID,
    "responsible_tax_id" VARCHAR(20),
    "payment_method" VARCHAR(10),
    "payment_timing" VARCHAR(20),
    "amount_cents" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "bank_code" VARCHAR(10),
    "branch_code" VARCHAR(10),
    "account_number" VARCHAR(30),
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_payment_components" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "description" VARCHAR(160),
    "amount_cents" DECIMAL(20,0) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_payment_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_seals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "note" VARCHAR(255),
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_seals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_transmission_attempts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "operation" VARCHAR(40) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "request_hash" CHAR(64),
    "status_code" VARCHAR(10),
    "response_reason" TEXT,
    "response_payload" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_transmission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_xml_artifacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "layout_version" VARCHAR(20) NOT NULL,
    "schema_version" VARCHAR(30) NOT NULL,
    "process_version" VARCHAR(60) NOT NULL,
    "content" TEXT NOT NULL,
    "hash_sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_xml_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mdfe_loading_municipalities_company_id_idx" ON "mdfe_loading_municipalities"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_loading_municipalities_mdfe_draft_id_sequence_idx" ON "mdfe_loading_municipalities"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_loading_municipalities_mdfe_draft_id_city_code_key" ON "mdfe_loading_municipalities"("mdfe_draft_id", "city_code");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_loading_municipalities_mdfe_draft_id_sequence_key" ON "mdfe_loading_municipalities"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_trailers_company_id_idx" ON "mdfe_trailers"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_trailers_plate_idx" ON "mdfe_trailers"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_trailers_mdfe_draft_id_plate_key" ON "mdfe_trailers"("mdfe_draft_id", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_trailers_mdfe_draft_id_sequence_key" ON "mdfe_trailers"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_contractors_company_id_idx" ON "mdfe_contractors"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_contractors_mdfe_draft_id_tax_id_key" ON "mdfe_contractors"("mdfe_draft_id", "tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_contractors_mdfe_draft_id_sequence_key" ON "mdfe_contractors"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_ciots_company_id_idx" ON "mdfe_ciots"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_ciots_contractor_id_idx" ON "mdfe_ciots"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_ciots_mdfe_draft_id_number_key" ON "mdfe_ciots"("mdfe_draft_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_ciots_mdfe_draft_id_sequence_key" ON "mdfe_ciots"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_toll_vouchers_company_id_idx" ON "mdfe_toll_vouchers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_toll_vouchers_mdfe_draft_id_provider_cnpj_purchase_num_key" ON "mdfe_toll_vouchers"("mdfe_draft_id", "provider_cnpj", "purchase_number");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_toll_vouchers_mdfe_draft_id_sequence_key" ON "mdfe_toll_vouchers"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_payments_company_id_idx" ON "mdfe_payments"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_payments_contractor_id_idx" ON "mdfe_payments"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_payments_mdfe_draft_id_sequence_key" ON "mdfe_payments"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_payment_components_company_id_idx" ON "mdfe_payment_components"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_payment_components_payment_id_sequence_key" ON "mdfe_payment_components"("payment_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_seals_company_id_idx" ON "mdfe_seals"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_seals_mdfe_draft_id_number_key" ON "mdfe_seals"("mdfe_draft_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_seals_mdfe_draft_id_sequence_key" ON "mdfe_seals"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_transmission_attempts_mdfe_draft_id_created_at_idx" ON "mdfe_transmission_attempts"("mdfe_draft_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mdfe_transmission_attempts_company_id_operation_status_idx" ON "mdfe_transmission_attempts"("company_id", "operation", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_transmission_attempts_company_id_idempotency_key_key" ON "mdfe_transmission_attempts"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "mdfe_xml_artifacts_company_id_idx" ON "mdfe_xml_artifacts"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_xml_artifacts_mdfe_draft_id_created_at_idx" ON "mdfe_xml_artifacts"("mdfe_draft_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_xml_artifacts_mdfe_draft_id_kind_hash_sha256_key" ON "mdfe_xml_artifacts"("mdfe_draft_id", "kind", "hash_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_drafts_access_key_key" ON "mdfe_drafts"("access_key");

-- CreateIndex
CREATE INDEX "mdfe_drafts_company_id_access_key_idx" ON "mdfe_drafts"("company_id", "access_key");

-- CreateIndex
CREATE INDEX "mdfe_drafts_company_id_deleted_at_idx" ON "mdfe_drafts"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "mdfe_fiscal_document_links_unloading_city_id_idx" ON "mdfe_fiscal_document_links"("unloading_city_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_insurances_mdfe_draft_id_policy_number_key" ON "mdfe_insurances"("mdfe_draft_id", "policy_number");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_events_mdfe_draft_id_type_idempotency_key_key" ON "mdfe_events"("mdfe_draft_id", "type", "idempotency_key");

-- AddForeignKey
ALTER TABLE "mdfe_loading_municipalities" ADD CONSTRAINT "mdfe_loading_municipalities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_loading_municipalities" ADD CONSTRAINT "mdfe_loading_municipalities_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_trailers" ADD CONSTRAINT "mdfe_trailers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_trailers" ADD CONSTRAINT "mdfe_trailers_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_fiscal_document_links" ADD CONSTRAINT "mdfe_fiscal_document_links_unloading_city_id_fkey" FOREIGN KEY ("unloading_city_id") REFERENCES "mdfe_unloading_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_contractors" ADD CONSTRAINT "mdfe_contractors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_contractors" ADD CONSTRAINT "mdfe_contractors_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_ciots" ADD CONSTRAINT "mdfe_ciots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_ciots" ADD CONSTRAINT "mdfe_ciots_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_ciots" ADD CONSTRAINT "mdfe_ciots_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "mdfe_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_toll_vouchers" ADD CONSTRAINT "mdfe_toll_vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_toll_vouchers" ADD CONSTRAINT "mdfe_toll_vouchers_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_payments" ADD CONSTRAINT "mdfe_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_payments" ADD CONSTRAINT "mdfe_payments_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_payments" ADD CONSTRAINT "mdfe_payments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "mdfe_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_payment_components" ADD CONSTRAINT "mdfe_payment_components_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_payment_components" ADD CONSTRAINT "mdfe_payment_components_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "mdfe_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_seals" ADD CONSTRAINT "mdfe_seals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_seals" ADD CONSTRAINT "mdfe_seals_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_transmission_attempts" ADD CONSTRAINT "mdfe_transmission_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_transmission_attempts" ADD CONSTRAINT "mdfe_transmission_attempts_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_xml_artifacts" ADD CONSTRAINT "mdfe_xml_artifacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_xml_artifacts" ADD CONSTRAINT "mdfe_xml_artifacts_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
