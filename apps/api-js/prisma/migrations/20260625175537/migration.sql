-- DropIndex
DROP INDEX "companies_icms_contributor_status_idx";

-- DropIndex
DROP INDEX "companies_state_registration_idx";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "state_registration_validated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "manifestations" ADD COLUMN     "request_xml_sanitized" TEXT,
ADD COLUMN     "response_xml_sanitized" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "tipo_pessoa" VARCHAR(2) NOT NULL,
    "nome" VARCHAR(255),
    "razao_social" VARCHAR(255),
    "nome_fantasia" VARCHAR(255),
    "cpf" VARCHAR(11),
    "cnpj" VARCHAR(14),
    "inscricao_estadual" VARCHAR(40),
    "inscricao_municipal" VARCHAR(40),
    "regime_tributario" VARCHAR(60),
    "cnae" VARCHAR(20),
    "atividade_economica" VARCHAR(255),
    "natureza_juridica" VARCHAR(100),
    "situacao_cadastral" VARCHAR(100),
    "rg" VARCHAR(30),
    "data_nascimento" TIMESTAMP(3),
    "cep" VARCHAR(8),
    "logradouro" VARCHAR(255),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(255),
    "bairro" VARCHAR(100),
    "municipio" VARCHAR(120),
    "uf" CHAR(2),
    "codigo_ibge" VARCHAR(20),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "observacoes" TEXT,
    "fonte_dados" VARCHAR(100),
    "dados_originais_json" JSONB,
    "alertas_json" JSONB,
    "validado_por_ia" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_cpf_key" ON "clients"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cnpj_key" ON "clients"("cnpj");

-- CreateIndex
CREATE INDEX "clients_owner_id_idx" ON "clients"("owner_id");

-- CreateIndex
CREATE INDEX "clients_cpf_idx" ON "clients"("cpf");

-- CreateIndex
CREATE INDEX "clients_cnpj_idx" ON "clients"("cnpj");

-- CreateIndex
CREATE INDEX "clients_tipo_pessoa_idx" ON "clients"("tipo_pessoa");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fiscal_document_links_company_nfe_cte_type_key" RENAME TO "fiscal_document_links_company_id_nfe_access_key_cte_access__key";

-- RenameIndex
ALTER INDEX "monthly_tax_closing_items_closing_category_idx" RENAME TO "monthly_tax_closing_items_closing_id_category_idx";

-- RenameIndex
ALTER INDEX "monthly_tax_closing_warnings_closing_severity_idx" RENAME TO "monthly_tax_closing_warnings_closing_id_severity_idx";

-- RenameIndex
ALTER INDEX "monthly_tax_closings_company_period_idx" RENAME TO "monthly_tax_closings_company_id_period_year_period_month_idx";

-- RenameIndex
ALTER INDEX "monthly_tax_closings_company_period_key" RENAME TO "monthly_tax_closings_company_id_period_year_period_month_key";

-- RenameIndex
ALTER INDEX "tax_rules_company_cfop_ncm_idx" RENAME TO "tax_rules_company_id_cfop_ncm_idx";

-- RenameIndex
ALTER INDEX "tax_rules_company_tax_type_idx" RENAME TO "tax_rules_company_id_tax_type_idx";

-- RenameIndex
ALTER INDEX "tax_rules_effective_period_idx" RENAME TO "tax_rules_effective_from_effective_until_idx";
