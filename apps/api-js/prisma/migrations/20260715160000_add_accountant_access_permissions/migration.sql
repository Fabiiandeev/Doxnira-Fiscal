ALTER TABLE "accountant_user_company_access"
  ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb;
