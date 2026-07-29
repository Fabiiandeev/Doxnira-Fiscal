CREATE TABLE "accountant_fiscal_queue_items" (
  "id" UUID NOT NULL,
  "office_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "type" VARCHAR(60) NOT NULL,
  "origin" VARCHAR(60) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  "responsible_user_id" UUID,
  "due_at" TIMESTAMP(3),
  "sla_minutes" INTEGER,
  "related_entity_type" VARCHAR(60),
  "related_entity_id" UUID,
  "competence" VARCHAR(7),
  "evidence" JSONB,
  "resolution_reason" TEXT,
  "dismissed_reason" TEXT,
  "reopen_reason" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "accountant_fiscal_queue_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accountant_fiscal_queue_items_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accountant_fiscal_queue_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accountant_fiscal_queue_items_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "accountant_fiscal_queue_items_office_id_company_id_status_priority_idx" ON "accountant_fiscal_queue_items"("office_id", "company_id", "status", "priority");
CREATE INDEX "accountant_fiscal_queue_items_company_id_created_at_idx" ON "accountant_fiscal_queue_items"("company_id", "created_at" DESC);
CREATE INDEX "accountant_fiscal_queue_items_responsible_user_id_status_idx" ON "accountant_fiscal_queue_items"("responsible_user_id", "status");
