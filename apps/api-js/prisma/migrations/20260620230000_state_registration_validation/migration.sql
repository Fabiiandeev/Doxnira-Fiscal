-- AlterTable
ALTER TABLE "companies" 
ADD COLUMN "state_registration_status" VARCHAR(30) DEFAULT 'PENDENTE_VALIDACAO_SEFAZ',
ADD COLUMN "state_registration_source" VARCHAR(50),
ADD COLUMN "state_registration_validated_at" TIMESTAMP,
ADD COLUMN "state_registration_formatted" VARCHAR(40),
ADD COLUMN "icms_contributor_status" VARCHAR(30) DEFAULT 'PENDENTE_VALIDACAO_SEFAZ';

-- CreateIndex
CREATE INDEX "companies_state_registration_idx" ON "companies"("state_registration");
CREATE INDEX "companies_icms_contributor_status_idx" ON "companies"("icms_contributor_status");
