BEGIN;

ALTER TABLE "audit_logs"
  ADD COLUMN "origin" VARCHAR(80),
  ADD COLUMN "correlation_id" VARCHAR(120),
  ADD COLUMN "idempotency_key" VARCHAR(180),
  ADD COLUMN "before_state" JSONB,
  ADD COLUMN "after_state" JSONB,
  ADD COLUMN "justification" TEXT,
  ADD COLUMN "document_id" UUID;

CREATE INDEX "audit_logs_company_id_correlation_id_idx"
  ON "audit_logs"("company_id", "correlation_id");

ALTER TABLE "payables"
  ADD COLUMN "canceled_at" TIMESTAMP(3),
  ADD COLUMN "canceled_by" UUID,
  ADD COLUMN "cancellation_reason" TEXT;

ALTER TABLE "receivables"
  ADD COLUMN "canceled_at" TIMESTAMP(3),
  ADD COLUMN "canceled_by" UUID,
  ADD COLUMN "cancellation_reason" TEXT;

CREATE TABLE "company_memberships" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "company_memberships" ("id", "company_id", "user_id", "role", "permissions")
SELECT gen_random_uuid(), "id", "owner_id", 'OWNER'::"UserRole", '["financial:read","financial:write"]'::jsonb
FROM "companies"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "company_memberships_company_id_user_id_key" ON "company_memberships"("company_id", "user_id");
CREATE INDEX "company_memberships_user_id_status_idx" ON "company_memberships"("user_id", "status");
CREATE INDEX "company_memberships_company_id_status_idx" ON "company_memberships"("company_id", "status");

CREATE TABLE "financial_events" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID,
  "entity_type" VARCHAR(40) NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "origin" VARCHAR(80) NOT NULL,
  "correlation_id" VARCHAR(120) NOT NULL,
  "idempotency_key" VARCHAR(180),
  "before_state" JSONB,
  "after_state" JSONB,
  "justification" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "financial_events_company_entity_idx" ON "financial_events"("company_id", "entity_type", "entity_id", "created_at" DESC);
CREATE INDEX "financial_events_company_correlation_idx" ON "financial_events"("company_id", "correlation_id");

CREATE TABLE "financial_allocations" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "payable_id" UUID,
  "receivable_id" UUID,
  "cost_center_id" UUID NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_allocations_target_check" CHECK (("payable_id" IS NULL) <> ("receivable_id" IS NULL)),
  CONSTRAINT "financial_allocations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "financial_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_allocations_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_allocations_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_allocations_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "financial_allocations_company_payable_idx" ON "financial_allocations"("company_id", "payable_id", "active");
CREATE INDEX "financial_allocations_company_receivable_idx" ON "financial_allocations"("company_id", "receivable_id", "active");

CREATE TABLE "financial_attachments" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "payable_id" UUID,
  "receivable_id" UUID,
  "file_name" VARCHAR(255) NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "removed_at" TIMESTAMP(3),
  "removed_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_attachments_target_check" CHECK (("payable_id" IS NULL) <> ("receivable_id" IS NULL)),
  CONSTRAINT "financial_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_attachments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_attachments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "financial_attachments_company_payable_idx" ON "financial_attachments"("company_id", "payable_id", "removed_at");
CREATE INDEX "financial_attachments_company_receivable_idx" ON "financial_attachments"("company_id", "receivable_id", "removed_at");

COMMIT;
