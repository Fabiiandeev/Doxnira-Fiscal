-- CreateTable
CREATE TABLE "nfe_documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
    "numero" INTEGER,
    "serie" SMALLINT,
    "modelo" VARCHAR(5) NOT NULL DEFAULT '55',
    "natureza_operacao" VARCHAR(255),
    "tipo_operacao" VARCHAR(2),
    "finalidade" VARCHAR(2),
    "consumo_final" BOOLEAN,
    "indicador_presenca" VARCHAR(2),
    "ambiente" VARCHAR(1) NOT NULL DEFAULT '2',
    "chave_acesso" VARCHAR(44),
    "protocolo" VARCHAR(80),
    "data_emissao" TIMESTAMP(3),
    "data_saida" TIMESTAMP(3),
    "hora_saida" VARCHAR(8),
    "destinatario_id" UUID,
    "destinatario_nome" VARCHAR(255),
    "destinatario_cnpj" VARCHAR(14),
    "destinatario_cpf" VARCHAR(11),
    "destinatario_ie" VARCHAR(40),
    "destinatario_uf" CHAR(2),
    "xml_assinado" TEXT,
    "xml_transmitido" TEXT,
    "xml_retorno" TEXT,
    "xml_protocolo" TEXT,
    "xml_danfe" TEXT,
    "cStat" VARCHAR(10),
    "x_motivo" VARCHAR(500),
    "n_rec" VARCHAR(20),
    "can_transmit" BOOLEAN NOT NULL DEFAULT false,
    "validation_score" SMALLINT,
    "observacoes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_items" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "item_number" INTEGER NOT NULL,
    "product_id" UUID,
    "product_code" VARCHAR(80),
    "ean" VARCHAR(30),
    "description" VARCHAR(255) NOT NULL,
    "ncm" VARCHAR(20),
    "cest" VARCHAR(20),
    "cfop" VARCHAR(10),
    "cst" VARCHAR(10),
    "csosn" VARCHAR(10),
    "origem" SMALLINT,
    "unidade" VARCHAR(10) NOT NULL DEFAULT 'UN',
    "quantidade" DECIMAL(15,4) NOT NULL,
    "valor_unitario" DECIMAL(15,4) NOT NULL,
    "valor_total" DECIMAL(15,2) NOT NULL,
    "desconto_valor" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "desconto_percent" DECIMAL(5,2),
    "freight_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "other_costs" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "icms_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "icms_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "icms_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "icms_st_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "icms_st_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "icms_st_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fcp_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fcp_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "fcp_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ipi_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ipi_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "ipi_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pis_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pis_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "pis_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cofins_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cofins_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cofins_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_totals" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "valor_produtos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "frete" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "seguro" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outras_despesas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_icms_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_icms" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_icms_st_base" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_icms_st" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_fcp" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_ipi" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_pis" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_cofins" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_tributos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "icms_desonerado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_transport" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "modalidade_frete" VARCHAR(2) NOT NULL,
    "transportadora_id" UUID,
    "cnpj_transportadora" VARCHAR(14),
    "nome_transportadora" VARCHAR(255),
    "ie_transportadora" VARCHAR(40),
    "endereco_transportadora" VARCHAR(255),
    "municipio_transportadora" VARCHAR(120),
    "uf_transportadora" CHAR(2),
    "placa_veiculo" VARCHAR(10),
    "uf_placa" CHAR(2),
    "rntc" VARCHAR(20),
    "volumes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_billing" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "forma_pagamento" VARCHAR(2),
    "valor_pagamento" DECIMAL(15,2),
    "meio_pagamento" VARCHAR(3),
    "cartao_cnpj" VARCHAR(14),
    "cartao_numero" VARCHAR(4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_installments" (
    "id" UUID NOT NULL,
    "nfe_billing_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "numero" VARCHAR(60) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_observations" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "campo" VARCHAR(30),
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_references" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "chave_acesso" VARCHAR(44),
    "numero_nf" INTEGER,
    "serie_nf" SMALLINT,
    "modelo_nf" VARCHAR(5),
    "cnpj_emitente" VARCHAR(14),
    "data_emissao" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_validation_results" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "alert_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "auto_corrections" INTEGER NOT NULL DEFAULT 0,
    "rejection_probability" VARCHAR(20),
    "can_transmit" BOOLEAN NOT NULL DEFAULT false,
    "phases" JSONB,
    "duration_ms" INTEGER,
    "validated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_validation_issues" (
    "id" UUID NOT NULL,
    "validation_result_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "field" VARCHAR(120),
    "description" VARCHAR(500) NOT NULL,
    "impact" VARCHAR(500),
    "how_to_fix" VARCHAR(500),
    "auto_correct_available" BOOLEAN NOT NULL DEFAULT false,
    "auto_correct_value" VARCHAR(255),
    "base_legal" VARCHAR(255),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_validation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_auto_fixes" (
    "id" UUID NOT NULL,
    "validation_result_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issue_code" VARCHAR(20) NOT NULL,
    "field" VARCHAR(120) NOT NULL,
    "old_value" VARCHAR(500),
    "new_value" VARCHAR(500),
    "reason" VARCHAR(500) NOT NULL,
    "rule_applied" VARCHAR(120) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_auto_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_transmission_attempts" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "xml_enviado" TEXT,
    "cStat" VARCHAR(10),
    "x_motivo" VARCHAR(500),
    "n_rec" VARCHAR(20),
    "ambiente" VARCHAR(1),
    "uf" CHAR(2),
    "tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retorno_em" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_transmission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_sefaz_returns" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "cStat" VARCHAR(10),
    "x_motivo" VARCHAR(500),
    "n_rec" VARCHAR(20),
    "protocolo" VARCHAR(80),
    "ambiente" VARCHAR(1),
    "uf" CHAR(2),
    "xml_retorno" TEXT,
    "dh_recebto" TIMESTAMP(3),
    "tempo_medio" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_sefaz_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_authorizations" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "cStat" VARCHAR(10) NOT NULL,
    "x_motivo" VARCHAR(500) NOT NULL,
    "protocolo" VARCHAR(80) NOT NULL,
    "ambiente" VARCHAR(1) NOT NULL,
    "data_autorizacao" TIMESTAMP(3) NOT NULL,
    "xml_protocolo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_files" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(80),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_logs" (
    "id" UUID NOT NULL,
    "nfe_document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nfe_documents_company_id_idx" ON "nfe_documents"("company_id");
CREATE INDEX "nfe_documents_company_id_status_idx" ON "nfe_documents"("company_id", "status");
CREATE INDEX "nfe_documents_chave_acesso_idx" ON "nfe_documents"("chave_acesso");
CREATE INDEX "nfe_documents_numero_serie_idx" ON "nfe_documents"("numero", "serie");
CREATE INDEX "nfe_documents_destinatario_cnpj_idx" ON "nfe_documents"("destinatario_cnpj");
CREATE INDEX "nfe_documents_destinatario_cpf_idx" ON "nfe_documents"("destinatario_cpf");
CREATE INDEX "nfe_documents_company_id_created_at_idx" ON "nfe_documents"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "nfe_items_nfe_document_id_item_number_key" ON "nfe_items"("nfe_document_id", "item_number");
CREATE INDEX "nfe_items_company_id_idx" ON "nfe_items"("company_id");
CREATE INDEX "nfe_items_nfe_document_id_idx" ON "nfe_items"("nfe_document_id");
CREATE INDEX "nfe_items_ncm_idx" ON "nfe_items"("ncm");
CREATE INDEX "nfe_items_cfop_idx" ON "nfe_items"("cfop");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_totals_nfe_document_id_key" ON "nfe_totals"("nfe_document_id");
CREATE INDEX "nfe_totals_company_id_idx" ON "nfe_totals"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_transport_nfe_document_id_key" ON "nfe_transport"("nfe_document_id");
CREATE INDEX "nfe_transport_company_id_idx" ON "nfe_transport"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_billing_nfe_document_id_key" ON "nfe_billing"("nfe_document_id");
CREATE INDEX "nfe_billing_company_id_idx" ON "nfe_billing"("company_id");

-- CreateIndex
CREATE INDEX "nfe_installments_nfe_billing_id_idx" ON "nfe_installments"("nfe_billing_id");
CREATE INDEX "nfe_installments_company_id_idx" ON "nfe_installments"("company_id");

-- CreateIndex
CREATE INDEX "nfe_observations_nfe_document_id_idx" ON "nfe_observations"("nfe_document_id");
CREATE INDEX "nfe_observations_company_id_idx" ON "nfe_observations"("company_id");

-- CreateIndex
CREATE INDEX "nfe_references_nfe_document_id_idx" ON "nfe_references"("nfe_document_id");
CREATE INDEX "nfe_references_company_id_idx" ON "nfe_references"("company_id");

-- CreateIndex
CREATE INDEX "nfe_validation_results_nfe_document_id_idx" ON "nfe_validation_results"("nfe_document_id");
CREATE INDEX "nfe_validation_results_company_id_idx" ON "nfe_validation_results"("company_id");
CREATE INDEX "nfe_validation_results_company_id_validated_at_idx" ON "nfe_validation_results"("company_id", "validated_at" DESC);

-- CreateIndex
CREATE INDEX "nfe_validation_issues_validation_result_id_idx" ON "nfe_validation_issues"("validation_result_id");
CREATE INDEX "nfe_validation_issues_company_id_idx" ON "nfe_validation_issues"("company_id");
CREATE INDEX "nfe_validation_issues_severity_idx" ON "nfe_validation_issues"("severity");

-- CreateIndex
CREATE INDEX "nfe_auto_fixes_validation_result_id_idx" ON "nfe_auto_fixes"("validation_result_id");
CREATE INDEX "nfe_auto_fixes_company_id_idx" ON "nfe_auto_fixes"("company_id");

-- CreateIndex
CREATE INDEX "nfe_transmission_attempts_nfe_document_id_idx" ON "nfe_transmission_attempts"("nfe_document_id");
CREATE INDEX "nfe_transmission_attempts_company_id_idx" ON "nfe_transmission_attempts"("company_id");
CREATE INDEX "nfe_transmission_attempts_company_id_tentativa_em_idx" ON "nfe_transmission_attempts"("company_id", "tentativa_em" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "nfe_sefaz_returns_nfe_document_id_key" ON "nfe_sefaz_returns"("nfe_document_id");
CREATE INDEX "nfe_sefaz_returns_company_id_idx" ON "nfe_sefaz_returns"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_authorizations_nfe_document_id_key" ON "nfe_authorizations"("nfe_document_id");
CREATE INDEX "nfe_authorizations_company_id_idx" ON "nfe_authorizations"("company_id");
CREATE INDEX "nfe_authorizations_company_id_data_autorizacao_idx" ON "nfe_authorizations"("company_id", "data_autorizacao" DESC);

-- CreateIndex
CREATE INDEX "nfe_files_nfe_document_id_idx" ON "nfe_files"("nfe_document_id");
CREATE INDEX "nfe_files_company_id_idx" ON "nfe_files"("company_id");

-- CreateIndex
CREATE INDEX "nfe_logs_nfe_document_id_idx" ON "nfe_logs"("nfe_document_id");
CREATE INDEX "nfe_logs_company_id_idx" ON "nfe_logs"("company_id");
CREATE INDEX "nfe_logs_company_id_created_at_idx" ON "nfe_logs"("company_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "nfe_documents" ADD CONSTRAINT "nfe_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nfe_documents" ADD CONSTRAINT "nfe_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_items" ADD CONSTRAINT "nfe_items_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_items" ADD CONSTRAINT "nfe_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_totals" ADD CONSTRAINT "nfe_totals_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_totals" ADD CONSTRAINT "nfe_totals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_transport" ADD CONSTRAINT "nfe_transport_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_transport" ADD CONSTRAINT "nfe_transport_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_billing" ADD CONSTRAINT "nfe_billing_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_billing" ADD CONSTRAINT "nfe_billing_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_installments" ADD CONSTRAINT "nfe_installments_nfe_billing_id_fkey" FOREIGN KEY ("nfe_billing_id") REFERENCES "nfe_billing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_installments" ADD CONSTRAINT "nfe_installments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_observations" ADD CONSTRAINT "nfe_observations_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_observations" ADD CONSTRAINT "nfe_observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_references" ADD CONSTRAINT "nfe_references_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_references" ADD CONSTRAINT "nfe_references_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_validation_results" ADD CONSTRAINT "nfe_validation_results_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_validation_results" ADD CONSTRAINT "nfe_validation_results_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_validation_issues" ADD CONSTRAINT "nfe_validation_issues_validation_result_id_fkey" FOREIGN KEY ("validation_result_id") REFERENCES "nfe_validation_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_validation_issues" ADD CONSTRAINT "nfe_validation_issues_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_auto_fixes" ADD CONSTRAINT "nfe_auto_fixes_validation_result_id_fkey" FOREIGN KEY ("validation_result_id") REFERENCES "nfe_validation_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_auto_fixes" ADD CONSTRAINT "nfe_auto_fixes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_transmission_attempts" ADD CONSTRAINT "nfe_transmission_attempts_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_transmission_attempts" ADD CONSTRAINT "nfe_transmission_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_sefaz_returns" ADD CONSTRAINT "nfe_sefaz_returns_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_sefaz_returns" ADD CONSTRAINT "nfe_sefaz_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_authorizations" ADD CONSTRAINT "nfe_authorizations_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_authorizations" ADD CONSTRAINT "nfe_authorizations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_files" ADD CONSTRAINT "nfe_files_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_files" ADD CONSTRAINT "nfe_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_logs" ADD CONSTRAINT "nfe_logs_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_logs" ADD CONSTRAINT "nfe_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
