BEGIN;

ALTER TABLE "monthly_tax_closings"
  ADD COLUMN "office_id" UUID,
  ADD COLUMN "source_snapshot_at" TIMESTAMP(3),
  ADD COLUMN "tax_settings_snapshot_json" JSONB,
  ADD COLUMN "eligible_documents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "blocked_documents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pending_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "approved_by_user_id" UUID,
  ADD COLUMN "reopened_by_user_id" UUID,
  ADD COLUMN "reopened_at" TIMESTAMP(3),
  ADD COLUMN "approval_note" TEXT,
  ADD COLUMN "reopen_reason" TEXT;

ALTER TABLE "monthly_tax_closing_items" ADD COLUMN "exclusion_reason" TEXT;

CREATE TABLE "monthly_tax_closing_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "closing_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" VARCHAR(40) NOT NULL,
  "from_status" VARCHAR(30),
  "to_status" VARCHAR(30),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_tax_closing_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_tax_closing_events_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_tax_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "monthly_tax_closings_company_period_status_idx" ON "monthly_tax_closings"("company_id", "period_year", "period_month", "status");
CREATE INDEX "monthly_tax_closing_events_closing_id_created_at_idx" ON "monthly_tax_closing_events"("closing_id", "created_at");

COMMIT;
