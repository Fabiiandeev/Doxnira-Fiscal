ALTER TABLE "platform_subscriptions"
  ADD COLUMN "company_id" UUID;

UPDATE "platform_subscriptions" AS subscription
SET "company_id" = company."id"
FROM "companies" AS company
WHERE subscription."billing_account_id" = company."id"::text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "platform_subscriptions" WHERE "company_id" IS NULL) THEN
    RAISE EXCEPTION 'Existing platform subscriptions must be associated with a valid company before D.1B';
  END IF;
END $$;

ALTER TABLE "platform_subscriptions"
  ALTER COLUMN "company_id" SET NOT NULL;

CREATE UNIQUE INDEX "platform_subscriptions_company_id_key"
  ON "platform_subscriptions"("company_id");

ALTER TABLE "platform_subscriptions"
  ADD CONSTRAINT "platform_subscriptions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_subscription_invoices"
  ADD COLUMN "invoice_slug" VARCHAR(160),
  ADD COLUMN "receipt_url" TEXT,
  ADD COLUMN "capture_method" VARCHAR(40),
  ADD COLUMN "paid_amount_cents" INTEGER;

CREATE TABLE "infinitepay_webhook_events" (
  "id" UUID NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "invoice_id" UUID,
  "order_nsu" VARCHAR(160),
  "transaction_nsu" VARCHAR(160),
  "payload" JSONB NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
  "failure_reason" VARCHAR(300),
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "infinitepay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "infinitepay_webhook_events_fingerprint_key"
  ON "infinitepay_webhook_events"("fingerprint");
CREATE INDEX "infinitepay_webhook_events_order_nsu_received_at_idx"
  ON "infinitepay_webhook_events"("order_nsu", "received_at" DESC);
CREATE INDEX "infinitepay_webhook_events_invoice_id_status_idx"
  ON "infinitepay_webhook_events"("invoice_id", "status");

ALTER TABLE "infinitepay_webhook_events"
  ADD CONSTRAINT "infinitepay_webhook_events_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "platform_subscription_invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "protect_subscription_invoice_snapshot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."subscription_id" IS DISTINCT FROM OLD."subscription_id"
    OR NEW."plan_id" IS DISTINCT FROM OLD."plan_id"
    OR NEW."plan_price_id" IS DISTINCT FROM OLD."plan_price_id"
    OR NEW."plan_code_snapshot" IS DISTINCT FROM OLD."plan_code_snapshot"
    OR NEW."plan_name_snapshot" IS DISTINCT FROM OLD."plan_name_snapshot"
    OR NEW."description_snapshot" IS DISTINCT FROM OLD."description_snapshot"
    OR NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."order_nsu" IS DISTINCT FROM OLD."order_nsu"
    OR NEW."period_start" IS DISTINCT FROM OLD."period_start"
    OR NEW."period_end" IS DISTINCT FROM OLD."period_end"
  THEN
    RAISE EXCEPTION 'Subscription invoice financial snapshot is immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "protect_subscription_invoice_snapshot_before_update"
BEFORE UPDATE ON "platform_subscription_invoices"
FOR EACH ROW
EXECUTE FUNCTION "protect_subscription_invoice_snapshot"();
