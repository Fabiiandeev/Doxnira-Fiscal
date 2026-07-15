DO $$ BEGIN
  CREATE TYPE "AccountantRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyLinkStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccessLevel" AS ENUM ('FULL', 'READ_ONLY', 'RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "accountant_offices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "cnpj" VARCHAR(14) NOT NULL,
  "address" VARCHAR(500),
  "phone" VARCHAR(40),
  "email" VARCHAR(180),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accountant_offices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accountant_offices_cnpj_key" ON "accountant_offices"("cnpj");

CREATE TABLE IF NOT EXISTS "accountant_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "AccountantRole" NOT NULL DEFAULT 'OPERATOR',
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accountant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accountant_memberships_office_id_user_id_key" ON "accountant_memberships"("office_id", "user_id");
CREATE INDEX IF NOT EXISTS "accountant_memberships_user_id_idx" ON "accountant_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "accountant_memberships_office_id_status_idx" ON "accountant_memberships"("office_id", "status");

CREATE TABLE IF NOT EXISTS "accountant_company_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "status" "CompanyLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accountant_company_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accountant_company_links_office_id_company_id_key" ON "accountant_company_links"("office_id", "company_id");
CREATE INDEX IF NOT EXISTS "accountant_company_links_company_id_idx" ON "accountant_company_links"("company_id");
CREATE INDEX IF NOT EXISTS "accountant_company_links_office_id_status_idx" ON "accountant_company_links"("office_id", "status");

CREATE TABLE IF NOT EXISTS "accountant_user_company_access" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "access_level" "AccessLevel" NOT NULL DEFAULT 'FULL',
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accountant_user_company_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accountant_user_company_access_membership_id_company_id_key" ON "accountant_user_company_access"("membership_id", "company_id");
CREATE INDEX IF NOT EXISTS "accountant_user_company_access_company_id_idx" ON "accountant_user_company_access"("company_id");
CREATE INDEX IF NOT EXISTS "accountant_user_company_access_membership_id_access_level_idx" ON "accountant_user_company_access"("membership_id", "access_level");

CREATE TABLE "accountant_document_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "fiscal_document_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reopened_at" TIMESTAMP(3),
  "reopen_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accountant_document_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accountant_document_reviews_office_id_fiscal_document_id_key" ON "accountant_document_reviews"("office_id", "fiscal_document_id");
CREATE INDEX "accountant_document_reviews_company_id_status_idx" ON "accountant_document_reviews"("company_id", "status");
CREATE INDEX "accountant_document_reviews_fiscal_document_id_idx" ON "accountant_document_reviews"("fiscal_document_id");

ALTER TABLE "accountant_memberships" ADD CONSTRAINT "accountant_memberships_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_memberships" ADD CONSTRAINT "accountant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_company_links" ADD CONSTRAINT "accountant_company_links_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_company_links" ADD CONSTRAINT "accountant_company_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_user_company_access" ADD CONSTRAINT "accountant_user_company_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "accountant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_user_company_access" ADD CONSTRAINT "accountant_user_company_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_document_reviews" ADD CONSTRAINT "accountant_document_reviews_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "accountant_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_document_reviews" ADD CONSTRAINT "accountant_document_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accountant_document_reviews" ADD CONSTRAINT "accountant_document_reviews_fiscal_document_id_fkey" FOREIGN KEY ("fiscal_document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accountant_document_reviews" ADD CONSTRAINT "accountant_document_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
