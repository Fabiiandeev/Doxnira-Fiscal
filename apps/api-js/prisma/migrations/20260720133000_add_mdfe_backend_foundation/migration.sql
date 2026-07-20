-- CreateEnum
CREATE TYPE "MdfeStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'READY_TO_TRANSMIT', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MdfeDocumentType" AS ENUM ('NFE', 'CTE');

-- CreateTable
CREATE TABLE "mdfe_drafts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "model" VARCHAR(2) NOT NULL DEFAULT '58',
    "series" VARCHAR(10) NOT NULL DEFAULT '1',
    "number" VARCHAR(30),
    "environment" "Environment" NOT NULL DEFAULT 'homologation',
    "emission_type" VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    "issuer_type" VARCHAR(30) NOT NULL,
    "carrier_type" VARCHAR(30) NOT NULL,
    "emission_date" TIMESTAMP(3),
    "loading_state" CHAR(2),
    "unloading_state" CHAR(2),
    "loading_city_code" VARCHAR(7),
    "status" "MdfeStatus" NOT NULL DEFAULT 'DRAFT',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "additional_info" TEXT,
    "fiscal_info" TEXT,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_route_states" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_route_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_unloading_cities" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "city_code" VARCHAR(7) NOT NULL,
    "city_name" VARCHAR(120) NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_unloading_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_vehicles" (
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
    "wheel_type" VARCHAR(30),
    "body_type" VARCHAR(30),
    "owner_type" VARCHAR(30),
    "owner_name" VARCHAR(255),
    "owner_cpf_cnpj" VARCHAR(14),
    "owner_state_registration" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_drivers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_fiscal_document_links" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "document_type" "MdfeDocumentType" NOT NULL,
    "nfe_entry_id" UUID,
    "cte_entry_id" UUID,
    "access_key" VARCHAR(44) NOT NULL,
    "document_number" VARCHAR(30),
    "series" VARCHAR(10),
    "unloading_city_code" VARCHAR(7),
    "gross_weight" DECIMAL(15,3),
    "document_value" DECIMAL(15,2),
    "sequence" INTEGER NOT NULL,
    "link_source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_fiscal_document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_insurances" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "responsible_type" VARCHAR(30) NOT NULL,
    "responsible_cpf_cnpj" VARCHAR(14),
    "insurer_name" VARCHAR(255) NOT NULL,
    "insurer_cnpj" VARCHAR(14) NOT NULL,
    "policy_number" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_insurance_endorsements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_insurance_id" UUID NOT NULL,
    "endorsement_number" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mdfe_insurance_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_validation_runs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "is_valid" BOOLEAN NOT NULL,
    "blocking_issues_count" INTEGER NOT NULL DEFAULT 0,
    "warning_issues_count" INTEGER NOT NULL DEFAULT 0,
    "calculation_hash" VARCHAR(64),
    "requested_by_id" UUID,
    "request_id" VARCHAR(80),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_validation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_validation_issues" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "validation_run_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "field" VARCHAR(120),
    "impact" TEXT,
    "current_value" TEXT,
    "expected_value" TEXT,
    "correction_type" VARCHAR(50),
    "can_auto_fix" BOOLEAN NOT NULL DEFAULT false,
    "suggested_action" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_validation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "previous_status" "MdfeStatus",
    "new_status" "MdfeStatus",
    "metadata" JSONB,
    "user_id" UUID,
    "request_id" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdfe_audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "mdfe_draft_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "user_id" UUID,
    "request_id" VARCHAR(80),
    "ip_address" VARCHAR(80),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdfe_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mdfe_drafts_company_id_status_idx" ON "mdfe_drafts"("company_id", "status");

-- CreateIndex
CREATE INDEX "mdfe_drafts_company_id_emission_date_idx" ON "mdfe_drafts"("company_id", "emission_date" DESC);

-- CreateIndex
CREATE INDEX "mdfe_drafts_company_id_series_number_idx" ON "mdfe_drafts"("company_id", "series", "number");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_drafts_company_id_series_number_key" ON "mdfe_drafts"("company_id", "series", "number");

-- CreateIndex
CREATE INDEX "mdfe_route_states_company_id_idx" ON "mdfe_route_states"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_route_states_mdfe_draft_id_sequence_idx" ON "mdfe_route_states"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_route_states_mdfe_draft_id_state_code_key" ON "mdfe_route_states"("mdfe_draft_id", "state_code");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_route_states_mdfe_draft_id_sequence_key" ON "mdfe_route_states"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_unloading_cities_company_id_idx" ON "mdfe_unloading_cities"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_unloading_cities_mdfe_draft_id_sequence_idx" ON "mdfe_unloading_cities"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_unloading_cities_mdfe_draft_id_city_code_key" ON "mdfe_unloading_cities"("mdfe_draft_id", "city_code");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_unloading_cities_mdfe_draft_id_sequence_key" ON "mdfe_unloading_cities"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_vehicles_mdfe_draft_id_key" ON "mdfe_vehicles"("mdfe_draft_id");

-- CreateIndex
CREATE INDEX "mdfe_vehicles_company_id_idx" ON "mdfe_vehicles"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_vehicles_plate_idx" ON "mdfe_vehicles"("plate");

-- CreateIndex
CREATE INDEX "mdfe_vehicles_rntrc_idx" ON "mdfe_vehicles"("rntrc");

-- CreateIndex
CREATE INDEX "mdfe_vehicles_owner_cpf_cnpj_idx" ON "mdfe_vehicles"("owner_cpf_cnpj");

-- CreateIndex
CREATE INDEX "mdfe_drivers_company_id_idx" ON "mdfe_drivers"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_drivers_mdfe_draft_id_sequence_idx" ON "mdfe_drivers"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_drivers_cpf_idx" ON "mdfe_drivers"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_drivers_mdfe_draft_id_cpf_key" ON "mdfe_drivers"("mdfe_draft_id", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_drivers_mdfe_draft_id_sequence_key" ON "mdfe_drivers"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE INDEX "mdfe_fiscal_document_links_company_id_idx" ON "mdfe_fiscal_document_links"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_fiscal_document_links_access_key_idx" ON "mdfe_fiscal_document_links"("access_key");

-- CreateIndex
CREATE INDEX "mdfe_fiscal_document_links_nfe_entry_id_idx" ON "mdfe_fiscal_document_links"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "mdfe_fiscal_document_links_cte_entry_id_idx" ON "mdfe_fiscal_document_links"("cte_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_fiscal_document_links_mdfe_draft_id_document_type_acce_key" ON "mdfe_fiscal_document_links"("mdfe_draft_id", "document_type", "access_key");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_fiscal_document_links_mdfe_draft_id_sequence_key" ON "mdfe_fiscal_document_links"("mdfe_draft_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_insurances_mdfe_draft_id_key" ON "mdfe_insurances"("mdfe_draft_id");

-- CreateIndex
CREATE INDEX "mdfe_insurances_company_id_idx" ON "mdfe_insurances"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_insurances_insurer_cnpj_idx" ON "mdfe_insurances"("insurer_cnpj");

-- CreateIndex
CREATE INDEX "mdfe_insurances_policy_number_idx" ON "mdfe_insurances"("policy_number");

-- CreateIndex
CREATE INDEX "mdfe_insurance_endorsements_company_id_idx" ON "mdfe_insurance_endorsements"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_insurance_endorsements_mdfe_insurance_id_idx" ON "mdfe_insurance_endorsements"("mdfe_insurance_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdfe_insurance_endorsements_mdfe_insurance_id_endorsement_n_key" ON "mdfe_insurance_endorsements"("mdfe_insurance_id", "endorsement_number");

-- CreateIndex
CREATE INDEX "mdfe_validation_runs_company_id_idx" ON "mdfe_validation_runs"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_validation_runs_mdfe_draft_id_created_at_idx" ON "mdfe_validation_runs"("mdfe_draft_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mdfe_validation_runs_request_id_idx" ON "mdfe_validation_runs"("request_id");

-- CreateIndex
CREATE INDEX "mdfe_validation_issues_company_id_idx" ON "mdfe_validation_issues"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_validation_issues_validation_run_id_idx" ON "mdfe_validation_issues"("validation_run_id");

-- CreateIndex
CREATE INDEX "mdfe_validation_issues_code_idx" ON "mdfe_validation_issues"("code");

-- CreateIndex
CREATE INDEX "mdfe_validation_issues_severity_idx" ON "mdfe_validation_issues"("severity");

-- CreateIndex
CREATE INDEX "mdfe_events_company_id_idx" ON "mdfe_events"("company_id");

-- CreateIndex
CREATE INDEX "mdfe_events_mdfe_draft_id_created_at_idx" ON "mdfe_events"("mdfe_draft_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mdfe_events_type_idx" ON "mdfe_events"("type");

-- CreateIndex
CREATE INDEX "mdfe_events_request_id_idx" ON "mdfe_events"("request_id");

-- CreateIndex
CREATE INDEX "mdfe_audit_logs_company_id_created_at_idx" ON "mdfe_audit_logs"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mdfe_audit_logs_mdfe_draft_id_created_at_idx" ON "mdfe_audit_logs"("mdfe_draft_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mdfe_audit_logs_action_idx" ON "mdfe_audit_logs"("action");

-- CreateIndex
CREATE INDEX "mdfe_audit_logs_entity_type_entity_id_idx" ON "mdfe_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "mdfe_audit_logs_request_id_idx" ON "mdfe_audit_logs"("request_id");

-- AddForeignKey
ALTER TABLE "mdfe_drafts" ADD CONSTRAINT "mdfe_drafts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_drafts" ADD CONSTRAINT "mdfe_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_drafts" ADD CONSTRAINT "mdfe_drafts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_route_states" ADD CONSTRAINT "mdfe_route_states_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_route_states" ADD CONSTRAINT "mdfe_route_states_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_unloading_cities" ADD CONSTRAINT "mdfe_unloading_cities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_unloading_cities" ADD CONSTRAINT "mdfe_unloading_cities_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_vehicles" ADD CONSTRAINT "mdfe_vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_vehicles" ADD CONSTRAINT "mdfe_vehicles_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_drivers" ADD CONSTRAINT "mdfe_drivers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_drivers" ADD CONSTRAINT "mdfe_drivers_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_fiscal_document_links" ADD CONSTRAINT "mdfe_fiscal_document_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_fiscal_document_links" ADD CONSTRAINT "mdfe_fiscal_document_links_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_fiscal_document_links" ADD CONSTRAINT "mdfe_fiscal_document_links_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_fiscal_document_links" ADD CONSTRAINT "mdfe_fiscal_document_links_cte_entry_id_fkey" FOREIGN KEY ("cte_entry_id") REFERENCES "cte_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_insurances" ADD CONSTRAINT "mdfe_insurances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_insurances" ADD CONSTRAINT "mdfe_insurances_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_insurance_endorsements" ADD CONSTRAINT "mdfe_insurance_endorsements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_insurance_endorsements" ADD CONSTRAINT "mdfe_insurance_endorsements_mdfe_insurance_id_fkey" FOREIGN KEY ("mdfe_insurance_id") REFERENCES "mdfe_insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_validation_runs" ADD CONSTRAINT "mdfe_validation_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_validation_runs" ADD CONSTRAINT "mdfe_validation_runs_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_validation_runs" ADD CONSTRAINT "mdfe_validation_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_validation_issues" ADD CONSTRAINT "mdfe_validation_issues_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_validation_issues" ADD CONSTRAINT "mdfe_validation_issues_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "mdfe_validation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_events" ADD CONSTRAINT "mdfe_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_events" ADD CONSTRAINT "mdfe_events_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_events" ADD CONSTRAINT "mdfe_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_audit_logs" ADD CONSTRAINT "mdfe_audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_audit_logs" ADD CONSTRAINT "mdfe_audit_logs_mdfe_draft_id_fkey" FOREIGN KEY ("mdfe_draft_id") REFERENCES "mdfe_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdfe_audit_logs" ADD CONSTRAINT "mdfe_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddMdfeIntegrityChecks
ALTER TABLE "mdfe_drafts"
  ADD CONSTRAINT "mdfe_drafts_model_58_check" CHECK ("model" = '58'),
  ADD CONSTRAINT "mdfe_drafts_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "mdfe_drafts_current_step_positive_check" CHECK ("current_step" >= 1);

ALTER TABLE "mdfe_route_states"
  ADD CONSTRAINT "mdfe_route_states_sequence_positive_check" CHECK ("sequence" > 0),
  ADD CONSTRAINT "mdfe_route_states_state_code_length_check" CHECK (char_length("state_code") = 2);

ALTER TABLE "mdfe_unloading_cities"
  ADD CONSTRAINT "mdfe_unloading_cities_sequence_positive_check" CHECK ("sequence" > 0),
  ADD CONSTRAINT "mdfe_unloading_cities_state_code_length_check" CHECK (char_length("state_code") = 2),
  ADD CONSTRAINT "mdfe_unloading_cities_city_code_not_empty_check" CHECK (char_length("city_code") > 0);

ALTER TABLE "mdfe_vehicles"
  ADD CONSTRAINT "mdfe_vehicles_tare_weight_nonnegative_check" CHECK ("tare_weight" IS NULL OR "tare_weight" >= 0),
  ADD CONSTRAINT "mdfe_vehicles_capacity_kg_nonnegative_check" CHECK ("capacity_kg" IS NULL OR "capacity_kg" >= 0),
  ADD CONSTRAINT "mdfe_vehicles_capacity_m3_nonnegative_check" CHECK ("capacity_m3" IS NULL OR "capacity_m3" >= 0);

ALTER TABLE "mdfe_drivers"
  ADD CONSTRAINT "mdfe_drivers_sequence_positive_check" CHECK ("sequence" > 0),
  ADD CONSTRAINT "mdfe_drivers_cpf_not_empty_check" CHECK (char_length("cpf") > 0);

ALTER TABLE "mdfe_fiscal_document_links"
  ADD CONSTRAINT "mdfe_fiscal_document_links_sequence_positive_check" CHECK ("sequence" > 0),
  ADD CONSTRAINT "mdfe_fiscal_document_links_gross_weight_nonnegative_check" CHECK ("gross_weight" IS NULL OR "gross_weight" >= 0),
  ADD CONSTRAINT "mdfe_fiscal_document_links_document_value_nonnegative_check" CHECK ("document_value" IS NULL OR "document_value" >= 0),
  ADD CONSTRAINT "mdfe_fiscal_document_links_access_key_not_empty_check" CHECK (char_length("access_key") > 0),
  ADD CONSTRAINT "mdfe_fiscal_document_links_exactly_one_source_check" CHECK (("nfe_entry_id" IS NOT NULL) <> ("cte_entry_id" IS NOT NULL)),
  ADD CONSTRAINT "mdfe_fiscal_document_links_document_type_source_check" CHECK (("document_type" = 'NFE' AND "nfe_entry_id" IS NOT NULL AND "cte_entry_id" IS NULL) OR ("document_type" = 'CTE' AND "cte_entry_id" IS NOT NULL AND "nfe_entry_id" IS NULL));

ALTER TABLE "mdfe_validation_runs"
  ADD CONSTRAINT "mdfe_validation_runs_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "mdfe_validation_runs_blocking_issues_nonnegative_check" CHECK ("blocking_issues_count" >= 0),
  ADD CONSTRAINT "mdfe_validation_runs_warning_issues_nonnegative_check" CHECK ("warning_issues_count" >= 0);
