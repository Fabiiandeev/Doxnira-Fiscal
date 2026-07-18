-- Migration: accountant_multidocument_targets
-- Permite que os quatro recursos do workspace contábil (reviews, notes, tag_links, requests)
-- sejam vinculados a exatamente um alvo: NF-e (fiscal_document_id) ou CT-e (transport_document_id).
-- Transacional, segura, com pre-check, FKs, índices parciais e constraint CHECK XOR.

BEGIN;

-- 1) Pré-verificação: detectar registros órfãos/zerados antes de tornar a coluna anulável.
-- Como todas as tabelas atuais só possuem fiscal_document_id NOT NULL, nenhum registro deve
-- estar sem alvo neste estágio. Validamos que não existem registros com fiscal_document_id NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "accountant_document_reviews"
    WHERE "fiscal_document_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'accountant_document_reviews possui registros sem fiscal_document_id antes da migration multidocumento';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "accountant_document_notes"
    WHERE "fiscal_document_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'accountant_document_notes possui registros sem fiscal_document_id antes da migration multidocumento';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "accountant_document_tag_links"
    WHERE "fiscal_document_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'accountant_document_tag_links possui registros sem fiscal_document_id antes da migration multidocumento';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "accountant_document_requests"
    WHERE "fiscal_document_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'accountant_document_requests possui registros sem fiscal_document_id antes da migration multidocumento';
  END IF;
END $$;

-- 2) Tornar fiscal_document_id anulável nos quatro alvos.
ALTER TABLE "accountant_document_reviews" ALTER COLUMN "fiscal_document_id" DROP NOT NULL;
ALTER TABLE "accountant_document_notes"    ALTER COLUMN "fiscal_document_id" DROP NOT NULL;
ALTER TABLE "accountant_document_tag_links" ALTER COLUMN "fiscal_document_id" DROP NOT NULL;
ALTER TABLE "accountant_document_requests" ALTER COLUMN "fiscal_document_id" DROP NOT NULL;

-- 3) Adicionar transport_document_id UUID NULL nos quatro alvos.
ALTER TABLE "accountant_document_reviews"
  ADD COLUMN "transport_document_id" UUID NULL;
ALTER TABLE "accountant_document_notes"
  ADD COLUMN "transport_document_id" UUID NULL;
ALTER TABLE "accountant_document_tag_links"
  ADD COLUMN "transport_document_id" UUID NULL;
ALTER TABLE "accountant_document_requests"
  ADD COLUMN "transport_document_id" UUID NULL;

-- 4) Colunas do lifecycle de solicitações à empresa.
ALTER TABLE "accountant_document_requests"
  ADD COLUMN "assigned_to_user_id" UUID NULL,
  ADD COLUMN "response_message" TEXT NULL,
  ADD COLUMN "responded_at" TIMESTAMP(3) NULL,
  ADD COLUMN "resolved_at" TIMESTAMP(3) NULL,
  ADD COLUMN "cancelled_at" TIMESTAMP(3) NULL;

-- 5) Constraint CHECK XOR: exatamente um dos dois alvos deve estar preenchido.
ALTER TABLE "accountant_document_reviews"
  ADD CONSTRAINT "accountant_document_reviews_target_xor"
  CHECK (
    ("fiscal_document_id" IS NOT NULL AND "transport_document_id" IS NULL)
    OR
    ("fiscal_document_id" IS NULL AND "transport_document_id" IS NOT NULL)
  );

ALTER TABLE "accountant_document_notes"
  ADD CONSTRAINT "accountant_document_notes_target_xor"
  CHECK (
    ("fiscal_document_id" IS NOT NULL AND "transport_document_id" IS NULL)
    OR
    ("fiscal_document_id" IS NULL AND "transport_document_id" IS NOT NULL)
  );

ALTER TABLE "accountant_document_tag_links"
  ADD CONSTRAINT "accountant_document_tag_links_target_xor"
  CHECK (
    ("fiscal_document_id" IS NOT NULL AND "transport_document_id" IS NULL)
    OR
    ("fiscal_document_id" IS NULL AND "transport_document_id" IS NOT NULL)
  );

ALTER TABLE "accountant_document_requests"
  ADD CONSTRAINT "accountant_document_requests_target_xor"
  CHECK (
    ("fiscal_document_id" IS NOT NULL AND "transport_document_id" IS NULL)
    OR
    ("fiscal_document_id" IS NULL AND "transport_document_id" IS NOT NULL)
  );

-- 6) Foreign keys para transport_documents com ON DELETE CASCADE (mesma semântica da FK de NF-e).
ALTER TABLE "accountant_document_reviews"
  ADD CONSTRAINT "accountant_document_reviews_transport_document_id_fkey"
  FOREIGN KEY ("transport_document_id") REFERENCES "transport_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accountant_document_notes"
  ADD CONSTRAINT "accountant_document_notes_transport_document_id_fkey"
  FOREIGN KEY ("transport_document_id") REFERENCES "transport_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accountant_document_tag_links"
  ADD CONSTRAINT "accountant_document_tag_links_transport_document_id_fkey"
  FOREIGN KEY ("transport_document_id") REFERENCES "transport_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accountant_document_requests"
  ADD CONSTRAINT "accountant_document_requests_transport_document_id_fkey"
  FOREIGN KEY ("transport_document_id") REFERENCES "transport_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK para users (assigned_to_user_id) em requests.
ALTER TABLE "accountant_document_requests"
  ADD CONSTRAINT "accountant_document_requests_assigned_to_user_id_fkey"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7) Ajustar constraints de unicidade para não misturar documentos.
-- A unicidade atual (office_id, fiscal_document_id) é necessária para reviews/links de tags,
-- porque garante um único registro por (escritório, NF-e). Mantemos a original e adicionamos
-- a equivalente para CT-e. O schema Prisma referencia ambas.
-- Para notes e requests não há unicidade anterior; apenas índices de escopo são adicionados.

-- Remover índice único antigo de tag_links antes de recriar (preserva a unique pelo office+NF-e+tag).
-- Não há necessidade de remover: o índice original continua válido porque fiscal_document_id
-- agora pode ser NULL, mas PostgreSQL trata NULL como distinto em UNIQUE, então links CT-e
-- (com fiscal_document_id NULL) não conflitam com os de NF-e.

-- 8) Novo índice único para (office_id, transport_document_id) em reviews.
CREATE UNIQUE INDEX "accountant_document_reviews_office_id_transport_document_id_key"
  ON "accountant_document_reviews"("office_id", "transport_document_id");

-- 9) Novo índice único para (office_id, transport_document_id, tag_id) em tag_links.
CREATE UNIQUE INDEX "accountant_document_tag_links_office_id_transport_document_id_tag_id_key"
  ON "accountant_document_tag_links"("office_id", "transport_document_id", "tag_id");

-- 10) Índices parciais e de escopo para NF-e (preservam comportamento atual) e CT-e.
--    Os índices parciais garantem que buscas por (company, transport_document) sejam rápidas
--    sem precisar percorrer registros de NF-e.

-- Reviews: índices parciais por alvo.
CREATE INDEX "accountant_document_reviews_transport_document_id_idx"
  ON "accountant_document_reviews"("transport_document_id")
  WHERE "transport_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_reviews_nfe_scope_idx"
  ON "accountant_document_reviews"("office_id", "company_id", "fiscal_document_id", "status")
  WHERE "fiscal_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_reviews_cte_scope_idx"
  ON "accountant_document_reviews"("office_id", "company_id", "transport_document_id", "status")
  WHERE "transport_document_id" IS NOT NULL;

-- Notes: escopo para CT-e (NF-e já possui índice existente).
CREATE INDEX "accountant_document_notes_cte_scope_idx"
  ON "accountant_document_notes"("office_id", "company_id", "transport_document_id", "created_at" DESC)
  WHERE "transport_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_notes_transport_document_id_idx"
  ON "accountant_document_notes"("transport_document_id")
  WHERE "transport_document_id" IS NOT NULL;

-- Tag links: escopo para CT-e (NF-e já possui índice existente).
CREATE INDEX "accountant_document_tag_links_cte_scope_idx"
  ON "accountant_document_tag_links"("office_id", "company_id", "transport_document_id")
  WHERE "transport_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_tag_links_transport_document_id_idx"
  ON "accountant_document_tag_links"("transport_document_id")
  WHERE "transport_document_id" IS NOT NULL;

-- Requests: escopo para CT-e + índice para lifecycle de empresa (company_id + status).
CREATE INDEX "accountant_document_requests_cte_scope_idx"
  ON "accountant_document_requests"("office_id", "company_id", "transport_document_id", "status")
  WHERE "transport_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_requests_transport_document_id_idx"
  ON "accountant_document_requests"("transport_document_id")
  WHERE "transport_document_id" IS NOT NULL;

CREATE INDEX "accountant_document_requests_company_status_created_idx"
  ON "accountant_document_requests"("company_id", "status", "created_at" DESC);

CREATE INDEX "accountant_document_requests_assigned_to_idx"
  ON "accountant_document_requests"("assigned_to_user_id")
  WHERE "assigned_to_user_id" IS NOT NULL;

-- 11) Comentários documentando a regra XOR nas tabelas.
COMMENT ON CONSTRAINT "accountant_document_reviews_target_xor"   ON "accountant_document_reviews"   IS 'Exatamente um alvo: fiscal_document_id XOR transport_document_id';
COMMENT ON CONSTRAINT "accountant_document_notes_target_xor"     ON "accountant_document_notes"    IS 'Exatamente um alvo: fiscal_document_id XOR transport_document_id';
COMMENT ON CONSTRAINT "accountant_document_tag_links_target_xor" ON "accountant_document_tag_links" IS 'Exatamente um alvo: fiscal_document_id XOR transport_document_id';
COMMENT ON CONSTRAINT "accountant_document_requests_target_xor"  ON "accountant_document_requests" IS 'Exatamente um alvo: fiscal_document_id XOR transport_document_id';

COMMIT;
