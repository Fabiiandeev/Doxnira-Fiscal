-- CreateTable
CREATE TABLE "nfe_validation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nfe_data" JSON NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "score" SMALLINT NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "alert_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "auto_corrections" INTEGER NOT NULL DEFAULT 0,
    "rejection_probability" VARCHAR(20),
    "situation" VARCHAR(40),
    "can_transmit" BOOLEAN NOT NULL DEFAULT false,
    "issues" JSON NOT NULL,
    "phases" JSON,
    "duration_ms" INTEGER,
    "validated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_validation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nfe_validation_runs_company_id_validated_at_idx" ON "nfe_validation_runs" ("company_id", "validated_at" DESC);
CREATE INDEX "nfe_validation_runs_company_id_status_idx" ON "nfe_validation_runs" ("company_id", "status");

ALTER TABLE "nfe_validation_runs" ADD CONSTRAINT "nfe_validation_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_validation_runs" ADD CONSTRAINT "nfe_validation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (gen_random_uuid(), '20260701120000_add_nfe_validation_runs', NOW(), '20260701120000_add_nfe_validation_runs', '', NULL, NOW(), 1);
