-- CreateEnum
CREATE TYPE "MdfeStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'READY_TO_TRANSMIT', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MdfeDocumentType" AS ENUM ('NFE', 'CTE');

-- DropForeignKey
ALTER TABLE "accountant_document_notes" DROP CONSTRAINT "accountant_document_notes_author_user_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_notes" DROP CONSTRAINT "accountant_document_notes_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_notes" DROP CONSTRAINT "accountant_document_notes_fiscal_document_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_notes" DROP CONSTRAINT "accountant_document_notes_office_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_request_events" DROP CONSTRAINT "accountant_document_request_events_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_request_events" DROP CONSTRAINT "accountant_document_request_events_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_request_events" DROP CONSTRAINT "accountant_document_request_events_office_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_request_events" DROP CONSTRAINT "accountant_document_request_events_request_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_requests" DROP CONSTRAINT "accountant_document_requests_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_requests" DROP CONSTRAINT "accountant_document_requests_fiscal_document_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_requests" DROP CONSTRAINT "accountant_document_requests_office_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_requests" DROP CONSTRAINT "accountant_document_requests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_tag_links" DROP CONSTRAINT "accountant_document_tag_links_company_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_tag_links" DROP CONSTRAINT "accountant_document_tag_links_fiscal_document_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_tag_links" DROP CONSTRAINT "accountant_document_tag_links_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_tags" DROP CONSTRAINT "accountant_document_tags_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "accountant_document_tags" DROP CONSTRAINT "accountant_document_tags_office_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_book_issues" DROP CONSTRAINT "fiscal_book_issues_preparation_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_book_preparation_documents" DROP CONSTRAINT "fiscal_book_preparation_documents_preparation_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_book_preparation_items" DROP CONSTRAINT "fiscal_book_preparation_items_preparation_document_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_book_preparations" DROP CONSTRAINT "fiscal_book_preparations_monthly_tax_closing_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_exports" DROP CONSTRAINT "fiscal_exports_closing_id_fkey";

-- DropForeignKey
ALTER TABLE "fiscal_exports" DROP CONSTRAINT "fiscal_exports_preparation_id_fkey";

-- DropIndex
DROP INDEX "accountant_document_requests_open_scope_idx";

-- AlterTable
ALTER TABLE "accountant_company_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_request_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_reviews" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_tag_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_document_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_memberships" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_offices" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accountant_user_company_access" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "atividades_incompativeis" JSONB,
ADD COLUMN     "atividades_permitidas" JSONB,
ADD COLUMN     "capital_social" VARCHAR(40),
ADD COLUMN     "cnae_secundarios" JSONB,
ADD COLUMN     "codigo_uf_ibge" VARCHAR(2),
ADD COLUMN     "contato_financeiro" VARCHAR(255),
ADD COLUMN     "contato_fiscal" VARCHAR(255),
ADD COLUMN     "contribuinte_icms" BOOLEAN,
ADD COLUMN     "contribuinte_iss" BOOLEAN,
ADD COLUMN     "crt" VARCHAR(2),
ADD COLUMN     "data_abertura" TIMESTAMP(6),
ADD COLUMN     "empresa_publica" BOOLEAN,
ADD COLUMN     "filial" BOOLEAN,
ADD COLUMN     "fiscal_ai" JSONB,
ADD COLUMN     "historico_json" JSONB,
ADD COLUMN     "ie_status" VARCHAR(40),
ADD COLUMN     "im_status" VARCHAR(40),
ADD COLUMN     "indicador_ie" VARCHAR(2),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "matriz" BOOLEAN,
ADD COLUMN     "mei" BOOLEAN,
ADD COLUMN     "optante_simples" BOOLEAN,
ADD COLUMN     "pais" VARCHAR(80),
ADD COLUMN     "porte" VARCHAR(60),
ADD COLUMN     "reforma_prep" JSONB,
ADD COLUMN     "retencoes" JSONB,
ADD COLUMN     "risco_fiscal_cnae" VARCHAR(20),
ADD COLUMN     "score_cadastro" SMALLINT,
ADD COLUMN     "score_detalhes" JSONB,
ADD COLUMN     "site" VARCHAR(255),
ADD COLUMN     "situacao_motivo" VARCHAR(200),
ADD COLUMN     "substituicao_tributaria" BOOLEAN,
ADD COLUMN     "tipo_contribuinte" VARCHAR(60),
ADD COLUMN     "ultima_consulta" TIMESTAMP(6),
ADD COLUMN     "whatsapp" VARCHAR(20);

-- AlterTable
ALTER TABLE "cte_allocation_documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cte_allocation_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cte_allocations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cte_entry_audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_book_issues" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_book_preparation_documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_book_preparation_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_book_preparations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_exports" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monthly_tax_closing_events" ALTER COLUMN "id" DROP DEFAULT;

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

-- CreateIndex
CREATE INDEX "accountant_document_request_events_office_id_company_id_cre_idx" ON "accountant_document_request_events"("office_id", "company_id", "created_at" DESC);

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

-- AddForeignKey
ALTER TABLE "fiscal_book_preparations" ADD CONSTRAINT "fiscal_book_preparations_monthly_tax_closing_id_fkey" FOREIGN KEY ("monthly_tax_closing_id") REFERENCES "monthly_tax_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_exports" ADD CONSTRAINT "fiscal_exports_preparation_id_fkey" FOREIGN KEY ("preparation_id") REFERENCES "fiscal_book_preparations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_exports" ADD CONSTRAINT "fiscal_exports_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_tax_closings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_book_preparation_documents" ADD CONSTRAINT "fiscal_book_preparation_documents_preparation_id_fkey" FOREIGN KEY ("preparation_id") REFERENCES "fiscal_book_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_book_preparation_items" ADD CONSTRAINT "fiscal_book_preparation_items_preparation_document_id_fkey" FOREIGN KEY ("preparation_document_id") REFERENCES "fiscal_book_preparation_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_book_issues" ADD CONSTRAINT "fiscal_book_issues_preparation_id_fkey" FOREIGN KEY ("preparation_id") REFERENCES "fiscal_book_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_notes" ADD CONSTRAINT "accountant_document_notes_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_notes" ADD CONSTRAINT "accountant_document_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_notes" ADD CONSTRAINT "accountant_document_notes_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_notes" ADD CONSTRAINT "accountant_document_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_tags" ADD CONSTRAINT "accountant_document_tags_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_tags" ADD CONSTRAINT "accountant_document_tags_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_tag_links" ADD CONSTRAINT "accountant_document_tag_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_tag_links" ADD CONSTRAINT "accountant_document_tag_links_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_tag_links" ADD CONSTRAINT "accountant_document_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "accountant_document_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_requests" ADD CONSTRAINT "accountant_document_requests_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_requests" ADD CONSTRAINT "accountant_document_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_requests" ADD CONSTRAINT "accountant_document_requests_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_requests" ADD CONSTRAINT "accountant_document_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_request_events" ADD CONSTRAINT "accountant_document_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "accountant_document_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_request_events" ADD CONSTRAINT "accountant_document_request_events_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_request_events" ADD CONSTRAINT "accountant_document_request_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_document_request_events" ADD CONSTRAINT "accountant_document_request_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "accountant_document_notes_cte_scope_idx" RENAME TO "accountant_document_notes_office_id_company_id_transport_do_idx";

-- RenameIndex
ALTER INDEX "accountant_document_notes_scope_idx" RENAME TO "accountant_document_notes_office_id_company_id_fiscal_docum_idx";

-- RenameIndex
ALTER INDEX "accountant_document_request_events_request_created_idx" RENAME TO "accountant_document_request_events_request_id_created_at_idx";

-- RenameIndex
ALTER INDEX "accountant_document_requests_company_status_created_idx" RENAME TO "accountant_document_requests_company_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "accountant_document_requests_cte_scope_idx" RENAME TO "accountant_document_requests_office_id_company_id_transport_idx";

-- RenameIndex
ALTER INDEX "accountant_document_requests_scope_idx" RENAME TO "accountant_document_requests_office_id_company_id_fiscal_do_idx";

-- RenameIndex
ALTER INDEX "accountant_document_tag_links_cte_scope_idx" RENAME TO "accountant_document_tag_links_office_id_company_id_transpor_idx";

-- RenameIndex
ALTER INDEX "accountant_document_tag_links_office_id_fiscal_document_id_tag_" RENAME TO "accountant_document_tag_links_office_id_fiscal_document_id__key";

-- RenameIndex
ALTER INDEX "accountant_document_tag_links_office_id_transport_document_id_t" RENAME TO "accountant_document_tag_links_office_id_transport_document__key";

-- RenameIndex
ALTER INDEX "accountant_document_tag_links_scope_idx" RENAME TO "accountant_document_tag_links_office_id_company_id_fiscal_d_idx";

-- RenameIndex
ALTER INDEX "cte_allocation_documents_allocation_id_cte_entry_nfe_link_id_ke" RENAME TO "cte_allocation_documents_allocation_id_cte_entry_nfe_link_i_key";

-- RenameIndex
ALTER INDEX "cte_allocation_items_allocation_document_id_nfe_entry_item_id_k" RENAME TO "cte_allocation_items_allocation_document_id_nfe_entry_item__key";

-- RenameIndex
ALTER INDEX "fiscal_book_issues_preparation_severity_status_idx" RENAME TO "fiscal_book_issues_preparation_id_severity_status_idx";

-- RenameIndex
ALTER INDEX "fiscal_book_preparation_docum_preparation_id_source_documen_key" RENAME TO "fiscal_book_preparation_documents_preparation_id_source_doc_key";

-- RenameIndex
ALTER INDEX "fiscal_book_preparation_documents_preparation_group_idx" RENAME TO "fiscal_book_preparation_documents_preparation_id_operation__idx";

-- RenameIndex
ALTER INDEX "fiscal_book_preparations_company_period_status_idx" RENAME TO "fiscal_book_preparations_company_id_period_year_period_mont_idx";

-- RenameIndex
ALTER INDEX "fiscal_exports_company_office_period_generated_idx" RENAME TO "fiscal_exports_company_id_office_id_period_year_period_mont_idx";

-- RenameIndex
ALTER INDEX "fiscal_exports_company_preparation_idx" RENAME TO "fiscal_exports_company_id_preparation_id_idx";

-- RenameIndex
ALTER INDEX "monthly_tax_closings_company_period_status_idx" RENAME TO "monthly_tax_closings_company_id_period_year_period_month_st_idx";
