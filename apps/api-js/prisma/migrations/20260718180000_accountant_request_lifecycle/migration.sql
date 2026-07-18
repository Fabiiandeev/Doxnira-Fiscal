BEGIN;

ALTER TABLE "accountant_document_requests"
  ADD COLUMN "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "reopened_at" TIMESTAMP(3),
  ADD COLUMN "resolved_by_user_id" UUID,
  ADD COLUMN "cancelled_by_user_id" UUID,
  ADD COLUMN "last_response_at" TIMESTAMP(3),
  ADD COLUMN "last_response_by_user_id" UUID,
  ADD COLUMN "resolution_note" TEXT,
  ADD COLUMN "cancel_reason" TEXT,
  ADD COLUMN "reopen_reason" TEXT;

UPDATE "accountant_document_requests"
SET "opened_at" = "created_at"
WHERE "opened_at" IS NULL;

CREATE TABLE "accountant_document_request_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL,
  "office_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "actor_role" VARCHAR(20) NOT NULL,
  "event_type" VARCHAR(40) NOT NULL,
  "from_status" VARCHAR(20),
  "to_status" VARCHAR(20),
  "message" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accountant_document_request_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accountant_document_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "accountant_document_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "accountant_document_request_events_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id"),
  CONSTRAINT "accountant_document_request_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id"),
  CONSTRAINT "accountant_document_request_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
);

CREATE INDEX "accountant_document_requests_open_scope_idx"
  ON "accountant_document_requests"("office_id", "company_id", "status", "created_at" DESC);
CREATE INDEX "accountant_document_request_events_request_created_idx"
  ON "accountant_document_request_events"("request_id", "created_at");

COMMIT;
