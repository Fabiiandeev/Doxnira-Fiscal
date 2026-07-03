-- Scope client records to a company instead of only to the creating user.
ALTER TABLE "clients" ADD COLUMN "company_id" UUID;

UPDATE "clients" c
SET "company_id" = (
    SELECT co."id"
    FROM "companies" co
    WHERE co."owner_id" = c."owner_id"
    ORDER BY co."created_at" ASC
    LIMIT 1
)
WHERE c."company_id" IS NULL;

ALTER TABLE "clients" ALTER COLUMN "company_id" SET NOT NULL;

DROP INDEX IF EXISTS "clients_cpf_key";
DROP INDEX IF EXISTS "clients_cnpj_key";

CREATE UNIQUE INDEX "clients_company_id_cpf_key" ON "clients"("company_id", "cpf");
CREATE UNIQUE INDEX "clients_company_id_cnpj_key" ON "clients"("company_id", "cnpj");
CREATE INDEX "clients_company_id_idx" ON "clients"("company_id");

ALTER TABLE "clients"
ADD CONSTRAINT "clients_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "transportadoras_company_id_cpf_key" ON "transportadoras"("company_id", "cpf");
CREATE UNIQUE INDEX "transportadoras_company_id_cnpj_key" ON "transportadoras"("company_id", "cnpj");
CREATE UNIQUE INDEX "fornecedores_company_id_cpf_key" ON "fornecedores"("company_id", "cpf");
CREATE UNIQUE INDEX "fornecedores_company_id_cnpj_key" ON "fornecedores"("company_id", "cnpj");
