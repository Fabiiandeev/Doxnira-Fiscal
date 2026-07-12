-- CreateTable
CREATE TABLE "nfe_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fiscal_document_id" UUID NOT NULL,
    "supplier_id" UUID,
    "status" VARCHAR(40) NOT NULL DEFAULT 'SINCRONIZADA',
    "source" VARCHAR(30) NOT NULL DEFAULT 'DFE_SYNC',
    "entry_status" VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
    "manifestation_status" VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_MANIFESTACAO',
    "stock_status" VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_ESTOQUE',
    "financial_status" VARCHAR(40) NOT NULL DEFAULT 'PENDENTE_FINANCEIRO',
    "cte_status" VARCHAR(40) NOT NULL DEFAULT 'SEM_CTE',
    "sefaz_status" VARCHAR(40),
    "access_key" VARCHAR(44) NOT NULL,
    "nsu" VARCHAR(15),
    "number" VARCHAR(30),
    "series" VARCHAR(10),
    "issue_date" TIMESTAMP(3),
    "authorization_date" TIMESTAMP(3),
    "supplier_name" VARCHAR(255),
    "supplier_cnpj" VARCHAR(14),
    "recipient_cnpj" VARCHAR(14),
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "products_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "protocol" VARCHAR(80),
    "xml_storage_key" TEXT,
    "xml_content" TEXT,
    "xml_hash_sha256" VARCHAR(64),
    "risk_score" SMALLINT NOT NULL DEFAULT 0,
    "recommendation" VARCHAR(30) NOT NULL DEFAULT 'REVISAR',
    "validation_summary" JSONB,
    "audit_trail" JSONB,
    "ignored_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "stock_posted_at" TIMESTAMP(3),
    "financial_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entry_items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID NOT NULL,
    "fiscal_document_item_id" UUID,
    "product_id" UUID,
    "item_number" INTEGER NOT NULL,
    "supplier_product_code" VARCHAR(80),
    "ean" VARCHAR(30),
    "description" VARCHAR(255),
    "ncm" VARCHAR(20),
    "cfop" VARCHAR(10),
    "cst" VARCHAR(10),
    "csosn" VARCHAR(10),
    "unit" VARCHAR(10),
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unit_value" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "link_status" VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    "link_confidence" SMALLINT,
    "stock_ignored" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entry_product_links" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID NOT NULL,
    "nfe_entry_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_cnpj" VARCHAR(14),
    "supplier_product_code" VARCHAR(80),
    "match_method" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "confidence" SMALLINT NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_entry_product_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entry_manifestations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "protocol" VARCHAR(80),
    "status" VARCHAR(30) NOT NULL,
    "justification" TEXT,
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_entry_manifestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entry_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" VARCHAR(80) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_entry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cte_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "transport_document_id" UUID,
    "access_key" VARCHAR(44) NOT NULL,
    "number" VARCHAR(30),
    "series" VARCHAR(10),
    "issue_date" TIMESTAMP(3),
    "carrier_name" VARCHAR(255),
    "carrier_cnpj" VARCHAR(14),
    "recipient_cnpj" VARCHAR(14),
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(40),
    "sefaz_status" VARCHAR(40),
    "referenced_nfe_keys" JSONB,
    "xml_storage_key" TEXT,
    "xml_content" TEXT,
    "source" VARCHAR(30) NOT NULL DEFAULT 'DFE_SYNC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cte_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cte_entry_nfe_links" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "cte_entry_id" UUID NOT NULL,
    "nfe_entry_id" UUID,
    "nfe_access_key" VARCHAR(44) NOT NULL,
    "freight_share" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "source" VARCHAR(30) NOT NULL DEFAULT 'CTE_XML',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cte_entry_nfe_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "nfe_entry_id" UUID,
    "nfe_entry_item_id" UUID,
    "movement_type" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit_cost" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "previous_stock" INTEGER,
    "new_stock" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID NOT NULL,
    "supplier_id" UUID,
    "supplier_name" VARCHAR(255),
    "supplier_cnpj" VARCHAR(14),
    "installment_number" VARCHAR(20) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_method" VARCHAR(60),
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "source" VARCHAR(30) NOT NULL DEFAULT 'NFE_ENTRY',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_alerts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "nfe_entry_id" UUID,
    "nfe_entry_item_id" UUID,
    "fiscal_document_id" UUID,
    "type" VARCHAR(80) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "fiscal_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfe_sync_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_type" VARCHAR(20) NOT NULL,
    "service" VARCHAR(60) NOT NULL DEFAULT 'DFE_SYNC',
    "mode" VARCHAR(20) NOT NULL DEFAULT 'mock',
    "status" VARCHAR(30) NOT NULL,
    "documents_found" INTEGER NOT NULL DEFAULT 0,
    "documents_saved" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "request_nsu" VARCHAR(15),
    "response_ult_nsu" VARCHAR(15),
    "response_max_nsu" VARCHAR(15),
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dfe_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entries_fiscal_document_id_key" ON "nfe_entries"("fiscal_document_id");

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_issue_date_idx" ON "nfe_entries"("company_id", "issue_date" DESC);

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_status_issue_date_idx" ON "nfe_entries"("company_id", "status", "issue_date" DESC);

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_manifestation_status_idx" ON "nfe_entries"("company_id", "manifestation_status");

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_entry_status_idx" ON "nfe_entries"("company_id", "entry_status");

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_stock_status_idx" ON "nfe_entries"("company_id", "stock_status");

-- CreateIndex
CREATE INDEX "nfe_entries_company_id_financial_status_idx" ON "nfe_entries"("company_id", "financial_status");

-- CreateIndex
CREATE INDEX "nfe_entries_supplier_cnpj_idx" ON "nfe_entries"("supplier_cnpj");

-- CreateIndex
CREATE INDEX "nfe_entries_number_series_idx" ON "nfe_entries"("number", "series");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entries_company_id_access_key_key" ON "nfe_entries"("company_id", "access_key");

-- CreateIndex
CREATE INDEX "nfe_entry_items_company_id_idx" ON "nfe_entry_items"("company_id");

-- CreateIndex
CREATE INDEX "nfe_entry_items_nfe_entry_id_idx" ON "nfe_entry_items"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "nfe_entry_items_fiscal_document_item_id_idx" ON "nfe_entry_items"("fiscal_document_item_id");

-- CreateIndex
CREATE INDEX "nfe_entry_items_product_id_idx" ON "nfe_entry_items"("product_id");

-- CreateIndex
CREATE INDEX "nfe_entry_items_company_id_link_status_idx" ON "nfe_entry_items"("company_id", "link_status");

-- CreateIndex
CREATE INDEX "nfe_entry_items_ean_idx" ON "nfe_entry_items"("ean");

-- CreateIndex
CREATE INDEX "nfe_entry_items_ncm_idx" ON "nfe_entry_items"("ncm");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entry_items_nfe_entry_id_item_number_key" ON "nfe_entry_items"("nfe_entry_id", "item_number");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entry_product_links_nfe_entry_item_id_key" ON "nfe_entry_product_links"("nfe_entry_item_id");

-- CreateIndex
CREATE INDEX "nfe_entry_product_links_company_id_idx" ON "nfe_entry_product_links"("company_id");

-- CreateIndex
CREATE INDEX "nfe_entry_product_links_nfe_entry_id_idx" ON "nfe_entry_product_links"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "nfe_entry_product_links_product_id_idx" ON "nfe_entry_product_links"("product_id");

-- CreateIndex
CREATE INDEX "nfe_entry_product_links_supplier_cnpj_supplier_product_code_idx" ON "nfe_entry_product_links"("supplier_cnpj", "supplier_product_code");

-- CreateIndex
CREATE INDEX "nfe_entry_manifestations_company_id_created_at_idx" ON "nfe_entry_manifestations"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "nfe_entry_manifestations_nfe_entry_id_idx" ON "nfe_entry_manifestations"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "nfe_entry_events_nfe_entry_id_created_at_idx" ON "nfe_entry_events"("nfe_entry_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "nfe_entry_events_company_id_created_at_idx" ON "nfe_entry_events"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cte_entries_transport_document_id_key" ON "cte_entries"("transport_document_id");

-- CreateIndex
CREATE INDEX "cte_entries_company_id_issue_date_idx" ON "cte_entries"("company_id", "issue_date" DESC);

-- CreateIndex
CREATE INDEX "cte_entries_carrier_cnpj_idx" ON "cte_entries"("carrier_cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "cte_entries_company_id_access_key_key" ON "cte_entries"("company_id", "access_key");

-- CreateIndex
CREATE INDEX "cte_entry_nfe_links_company_id_idx" ON "cte_entry_nfe_links"("company_id");

-- CreateIndex
CREATE INDEX "cte_entry_nfe_links_cte_entry_id_idx" ON "cte_entry_nfe_links"("cte_entry_id");

-- CreateIndex
CREATE INDEX "cte_entry_nfe_links_nfe_entry_id_idx" ON "cte_entry_nfe_links"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "cte_entry_nfe_links_nfe_access_key_idx" ON "cte_entry_nfe_links"("nfe_access_key");

-- CreateIndex
CREATE UNIQUE INDEX "cte_entry_nfe_links_company_id_cte_entry_id_nfe_access_key_key" ON "cte_entry_nfe_links"("company_id", "cte_entry_id", "nfe_access_key");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_created_at_idx" ON "stock_movements"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_nfe_entry_id_idx" ON "stock_movements"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "stock_movements_nfe_entry_item_id_idx" ON "stock_movements"("nfe_entry_item_id");

-- CreateIndex
CREATE INDEX "payables_company_id_due_date_idx" ON "payables"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "payables_supplier_id_idx" ON "payables"("supplier_id");

-- CreateIndex
CREATE INDEX "payables_nfe_entry_id_idx" ON "payables"("nfe_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payables_nfe_entry_id_installment_number_key" ON "payables"("nfe_entry_id", "installment_number");

-- CreateIndex
CREATE INDEX "fiscal_alerts_company_id_status_created_at_idx" ON "fiscal_alerts"("company_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fiscal_alerts_nfe_entry_id_idx" ON "fiscal_alerts"("nfe_entry_id");

-- CreateIndex
CREATE INDEX "fiscal_alerts_nfe_entry_item_id_idx" ON "fiscal_alerts"("nfe_entry_item_id");

-- CreateIndex
CREATE INDEX "fiscal_alerts_fiscal_document_id_idx" ON "fiscal_alerts"("fiscal_document_id");

-- CreateIndex
CREATE INDEX "dfe_sync_logs_company_id_started_at_idx" ON "dfe_sync_logs"("company_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "dfe_sync_logs_company_id_document_type_status_idx" ON "dfe_sync_logs"("company_id", "document_type", "status");

-- AddForeignKey
ALTER TABLE "nfe_entries" ADD CONSTRAINT "nfe_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entries" ADD CONSTRAINT "nfe_entries_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entries" ADD CONSTRAINT "nfe_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_items" ADD CONSTRAINT "nfe_entry_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_items" ADD CONSTRAINT "nfe_entry_items_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_items" ADD CONSTRAINT "nfe_entry_items_fiscal_document_item_id_fkey" FOREIGN KEY ("fiscal_document_item_id") REFERENCES "fiscal_document_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_items" ADD CONSTRAINT "nfe_entry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_product_links" ADD CONSTRAINT "nfe_entry_product_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_product_links" ADD CONSTRAINT "nfe_entry_product_links_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_product_links" ADD CONSTRAINT "nfe_entry_product_links_nfe_entry_item_id_fkey" FOREIGN KEY ("nfe_entry_item_id") REFERENCES "nfe_entry_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_product_links" ADD CONSTRAINT "nfe_entry_product_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_manifestations" ADD CONSTRAINT "nfe_entry_manifestations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_manifestations" ADD CONSTRAINT "nfe_entry_manifestations_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_events" ADD CONSTRAINT "nfe_entry_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entry_events" ADD CONSTRAINT "nfe_entry_events_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_entries" ADD CONSTRAINT "cte_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_entries" ADD CONSTRAINT "cte_entries_transport_document_id_fkey" FOREIGN KEY ("transport_document_id") REFERENCES "transport_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_entry_nfe_links" ADD CONSTRAINT "cte_entry_nfe_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_entry_nfe_links" ADD CONSTRAINT "cte_entry_nfe_links_cte_entry_id_fkey" FOREIGN KEY ("cte_entry_id") REFERENCES "cte_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cte_entry_nfe_links" ADD CONSTRAINT "cte_entry_nfe_links_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_nfe_entry_item_id_fkey" FOREIGN KEY ("nfe_entry_item_id") REFERENCES "nfe_entry_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_alerts" ADD CONSTRAINT "fiscal_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_alerts" ADD CONSTRAINT "fiscal_alerts_nfe_entry_id_fkey" FOREIGN KEY ("nfe_entry_id") REFERENCES "nfe_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_alerts" ADD CONSTRAINT "fiscal_alerts_nfe_entry_item_id_fkey" FOREIGN KEY ("nfe_entry_item_id") REFERENCES "nfe_entry_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_alerts" ADD CONSTRAINT "fiscal_alerts_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfe_sync_logs" ADD CONSTRAINT "dfe_sync_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
