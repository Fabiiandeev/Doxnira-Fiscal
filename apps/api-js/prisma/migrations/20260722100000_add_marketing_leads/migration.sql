CREATE TYPE "MarketingLeadInterest" AS ENUM ('PLAN_INFO', 'DEMO', 'INTEGRATION', 'COMMERCE', 'PORTAL_CONTABIL', 'SUPPORT', 'OTHER');
CREATE TYPE "MarketingLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

CREATE TABLE "marketing_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(150) NOT NULL,
  "phone" VARCHAR(30),
  "company_name" VARCHAR(150) NOT NULL,
  "document" VARCHAR(18),
  "interest" "MarketingLeadInterest" NOT NULL,
  "plan_code" "SubscriptionPlanCode",
  "subject" VARCHAR(200),
  "message" TEXT,
  "source" VARCHAR(200),
  "status" "MarketingLeadStatus" NOT NULL DEFAULT 'NEW',
  "request_id" VARCHAR(80) NOT NULL,
  "ip_hash" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_leads_email_created_at_idx" ON "marketing_leads"("email", "created_at");
CREATE INDEX "marketing_leads_plan_code_created_at_idx" ON "marketing_leads"("plan_code", "created_at");
CREATE INDEX "marketing_leads_request_id_idx" ON "marketing_leads"("request_id");
