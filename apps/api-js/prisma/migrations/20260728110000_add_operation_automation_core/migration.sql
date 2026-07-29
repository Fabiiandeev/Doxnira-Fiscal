CREATE TABLE "operation_automations" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "name" VARCHAR(160) NOT NULL,
 "description" VARCHAR(1000), "module" VARCHAR(40) NOT NULL, "event" VARCHAR(60) NOT NULL,
 "conditions" JSONB NOT NULL, "condition_logic" VARCHAR(3) NOT NULL DEFAULT 'AND',
 "actions" JSONB NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0,
 "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', "starts_at" TIMESTAMP(3), "ends_at" TIMESTAMP(3),
 "execution_limit" INTEGER, "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
 "responsible_id" UUID, "allow_self_trigger" BOOLEAN NOT NULL DEFAULT false,
 "max_depth" INTEGER NOT NULL DEFAULT 5, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "operation_automations_logic_check" CHECK ("condition_logic" IN ('AND','OR')),
 CONSTRAINT "operation_automations_status_check" CHECK ("status" IN ('ACTIVE','INACTIVE')),
 CONSTRAINT "operation_automations_limits_check" CHECK ("cooldown_seconds" >= 0 AND "max_depth" BETWEEN 1 AND 20 AND ("execution_limit" IS NULL OR "execution_limit" > 0))
);
CREATE INDEX "operation_automations_company_id_status_event_idx" ON "operation_automations"("company_id","status","event");

CREATE TABLE "operation_automation_runs" (
 "id" UUID PRIMARY KEY, "company_id" UUID NOT NULL, "automation_id" UUID NOT NULL,
 "event" VARCHAR(60) NOT NULL, "payload" JSONB NOT NULL, "evaluation" JSONB,
 "executed_actions" JSONB, "skipped_actions" JSONB, "blocked_actions" JSONB,
 "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED', "error" TEXT, "attempt" INTEGER NOT NULL DEFAULT 1,
 "request_id" VARCHAR(120), "correlation_id" VARCHAR(120) NOT NULL, "causation_id" VARCHAR(120),
 "depth" INTEGER NOT NULL DEFAULT 0, "idempotency_key" VARCHAR(180) NOT NULL,
 "origin" VARCHAR(60), "user_id" UUID, "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
 "finished_at" TIMESTAMP(3), "duration_ms" INTEGER,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "operation_automation_runs_status_check" CHECK ("status" IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELED','SKIPPED')),
 CONSTRAINT "operation_automation_runs_depth_check" CHECK ("depth" >= 0 AND "attempt" > 0)
);
CREATE UNIQUE INDEX "operation_automation_runs_company_id_idempotency_key_key" ON "operation_automation_runs"("company_id","idempotency_key");
CREATE INDEX "operation_automation_runs_company_id_status_created_at_idx" ON "operation_automation_runs"("company_id","status","created_at");
CREATE INDEX "operation_automation_runs_company_id_automation_id_created_at_idx" ON "operation_automation_runs"("company_id","automation_id","created_at");

ALTER TABLE "operation_automations" ADD CONSTRAINT "operation_automations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "operation_automations" ADD CONSTRAINT "operation_automations_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "operation_automation_runs" ADD CONSTRAINT "operation_automation_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "operation_automation_runs" ADD CONSTRAINT "operation_automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "operation_automations"("id") ON DELETE RESTRICT;
ALTER TABLE "operation_automation_runs" ADD CONSTRAINT "operation_automation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
