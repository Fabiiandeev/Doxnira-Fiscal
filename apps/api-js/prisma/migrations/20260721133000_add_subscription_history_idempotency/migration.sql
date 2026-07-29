ALTER TABLE "subscription_history"
ADD COLUMN "idempotency_key" VARCHAR(160);

CREATE UNIQUE INDEX "subscription_history_subscription_id_idempotency_key_key"
ON "subscription_history"("subscription_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
