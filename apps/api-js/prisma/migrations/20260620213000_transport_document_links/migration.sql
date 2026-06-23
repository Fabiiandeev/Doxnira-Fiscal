CREATE TABLE IF NOT EXISTS "transport_documents" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "access_key" VARCHAR(44) NOT NULL,
  "number" VARCHAR(30),
  "series" VARCHAR(10),
  "emission_date" TIMESTAMP(3),
  "issuer_cnpj" VARCHAR(14),
  "issuer_name" VARCHAR(255),
  "recipient_cnpj" VARCHAR(14),
  "recipient_name" VARCHAR(255),
  "total_amount" DECIMAL(15,2),
  "status" VARCHAR(40),
  "xml_storage_key" TEXT NOT NULL,
  "raw_xml_hash" VARCHAR(64) NOT NULL,
  "raw_xml" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transport_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_documents_company_id_access_key_key" UNIQUE ("company_id", "access_key"),
  CONSTRAINT "transport_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "transport_documents_company_id_emission_date_idx" ON "transport_documents"("company_id", "emission_date" DESC);
CREATE INDEX IF NOT EXISTS "transport_documents_issuer_cnpj_idx" ON "transport_documents"("issuer_cnpj");
CREATE INDEX IF NOT EXISTS "transport_documents_recipient_cnpj_idx" ON "transport_documents"("recipient_cnpj");
CREATE INDEX IF NOT EXISTS "transport_documents_created_at_idx" ON "transport_documents"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "fiscal_document_links" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "nfe_document_id" UUID,
  "cte_document_id" UUID NOT NULL,
  "nfe_access_key" VARCHAR(44) NOT NULL,
  "cte_access_key" VARCHAR(44) NOT NULL,
  "link_type" VARCHAR(30) NOT NULL DEFAULT 'NFE_CTE',
  "source" VARCHAR(30) NOT NULL DEFAULT 'CTE_XML',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_document_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_document_links_company_nfe_cte_type_key" UNIQUE ("company_id", "nfe_access_key", "cte_access_key", "link_type"),
  CONSTRAINT "fiscal_document_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_links_nfe_document_id_fkey" FOREIGN KEY ("nfe_document_id") REFERENCES "fiscal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_links_cte_document_id_fkey" FOREIGN KEY ("cte_document_id") REFERENCES "transport_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "fiscal_document_links_company_id_idx" ON "fiscal_document_links"("company_id");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_nfe_access_key_idx" ON "fiscal_document_links"("nfe_access_key");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_cte_access_key_idx" ON "fiscal_document_links"("cte_access_key");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_nfe_document_id_idx" ON "fiscal_document_links"("nfe_document_id");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_cte_document_id_idx" ON "fiscal_document_links"("cte_document_id");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_link_type_idx" ON "fiscal_document_links"("link_type");
CREATE INDEX IF NOT EXISTS "fiscal_document_links_created_at_idx" ON "fiscal_document_links"("created_at" DESC);
