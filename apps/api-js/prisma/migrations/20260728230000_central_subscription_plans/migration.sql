ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPER_ADMIN';

CREATE TYPE "SubscriptionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "PlanFeatureValueType" AS ENUM ('BOOLEAN', 'INTEGER', 'TEXT', 'UNLIMITED');
CREATE TYPE "PlanPriceApplicationPolicy" AS ENUM ('NEW_CUSTOMERS_ONLY', 'ALL_NEXT_RENEWAL', 'SELECTED_CUSTOMERS', 'SCHEDULED');
CREATE TYPE "PlatformSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED');
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('PENDING', 'OPEN', 'PAID', 'FAILED', 'CANCELED', 'EXPIRED');

CREATE TABLE "platform_subscription_plans" (
  "id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "title" VARCHAR(200),
  "short_description" VARCHAR(300),
  "description" TEXT,
  "status" "SubscriptionPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "public_visible" BOOLEAN NOT NULL DEFAULT false,
  "available_for_sale" BOOLEAN NOT NULL DEFAULT false,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "trial_days" INTEGER NOT NULL DEFAULT 0,
  "checkout_description" VARCHAR(500),
  "button_label" VARCHAR(100) NOT NULL DEFAULT 'Começar agora',
  "badge_label" VARCHAR(100),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "platform_subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_plan_prices" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "interval" "SubscriptionBillingInterval" NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "amount_cents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_until" TIMESTAMP(3),
  "application_policy" "PlanPriceApplicationPolicy" NOT NULL DEFAULT 'NEW_CUSTOMERS_ONLY',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_subscription_plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_plan_features" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "label" VARCHAR(180) NOT NULL,
  "description" VARCHAR(400),
  "value_type" "PlanFeatureValueType" NOT NULL,
  "value" VARCHAR(300),
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "platform_subscription_plan_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscriptions" (
  "id" UUID NOT NULL,
  "billing_account_id" VARCHAR(160) NOT NULL,
  "plan_id" UUID NOT NULL,
  "plan_price_id" UUID NOT NULL,
  "status" "PlatformSubscriptionStatus" NOT NULL,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_subscription_invoices" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "plan_price_id" UUID NOT NULL,
  "plan_code_snapshot" VARCHAR(60) NOT NULL,
  "plan_name_snapshot" VARCHAR(160) NOT NULL,
  "description_snapshot" VARCHAR(500),
  "amount_cents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "order_nsu" VARCHAR(160) NOT NULL,
  "checkout_url" TEXT,
  "transaction_nsu" VARCHAR(160),
  "status" "SubscriptionInvoiceStatus" NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_subscription_plans_code_key" ON "platform_subscription_plans"("code");
CREATE UNIQUE INDEX "platform_subscription_plans_slug_key" ON "platform_subscription_plans"("slug");
CREATE INDEX "platform_subscription_plans_status_public_visible_idx" ON "platform_subscription_plans"("status", "public_visible");
CREATE INDEX "platform_subscription_plans_status_available_for_sale_idx" ON "platform_subscription_plans"("status", "available_for_sale");
CREATE INDEX "platform_subscription_plans_sort_order_idx" ON "platform_subscription_plans"("sort_order");
CREATE INDEX "platform_subscription_plan_prices_plan_id_interval_active_idx" ON "platform_subscription_plan_prices"("plan_id", "interval", "active");
CREATE INDEX "platform_subscription_plan_prices_valid_from_valid_until_idx" ON "platform_subscription_plan_prices"("valid_from", "valid_until");
CREATE UNIQUE INDEX "platform_subscription_plan_features_plan_id_code_key" ON "platform_subscription_plan_features"("plan_id", "code");
CREATE INDEX "platform_subscription_plan_features_plan_id_visible_sort_order_idx" ON "platform_subscription_plan_features"("plan_id", "visible", "sort_order");
CREATE UNIQUE INDEX "platform_subscriptions_billing_account_id_key" ON "platform_subscriptions"("billing_account_id");
CREATE INDEX "platform_subscriptions_plan_id_status_idx" ON "platform_subscriptions"("plan_id", "status");
CREATE UNIQUE INDEX "platform_subscription_invoices_order_nsu_key" ON "platform_subscription_invoices"("order_nsu");
CREATE UNIQUE INDEX "platform_subscription_invoices_transaction_nsu_key" ON "platform_subscription_invoices"("transaction_nsu");
CREATE INDEX "platform_subscription_invoices_subscription_id_created_at_idx" ON "platform_subscription_invoices"("subscription_id", "created_at" DESC);
CREATE INDEX "platform_subscription_invoices_plan_id_status_idx" ON "platform_subscription_invoices"("plan_id", "status");

ALTER TABLE "platform_subscription_plans" ADD CONSTRAINT "platform_subscription_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_plans" ADD CONSTRAINT "platform_subscription_plans_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_plan_prices" ADD CONSTRAINT "platform_subscription_plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_plan_prices" ADD CONSTRAINT "platform_subscription_plan_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_plan_features" ADD CONSTRAINT "platform_subscription_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_price_id_fkey" FOREIGN KEY ("plan_price_id") REFERENCES "platform_subscription_plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_invoices" ADD CONSTRAINT "platform_subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "platform_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_invoices" ADD CONSTRAINT "platform_subscription_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_subscription_invoices" ADD CONSTRAINT "platform_subscription_invoices_plan_price_id_fkey" FOREIGN KEY ("plan_price_id") REFERENCES "platform_subscription_plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "platform_subscription_plans" ("id","code","slug","name","short_description","status","public_visible","available_for_sale","featured","sort_order","button_label","badge_label","created_at","updated_at") VALUES
('11000000-0000-4000-8000-000000000001','STARTER','starter','Starter + Portal Contábil','Operação fiscal essencial para começar com segurança.','ACTIVE',true,true,false,1,'Começar agora',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('11000000-0000-4000-8000-000000000002','PROFESSIONAL','profissional','Professional + Portal Contábil','Automação e inteligência fiscal para operações em crescimento.','ACTIVE',true,true,true,2,'Começar agora','Mais escolhido',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('11000000-0000-4000-8000-000000000003','BUSINESS','business','Business + Portal Contábil','Integrações, automações e controles para operações mais exigentes.','ACTIVE',true,true,false,3,'Começar agora',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('11000000-0000-4000-8000-000000000004','COMPANY','empresa','Empresa + Portal Contábil','Configuração personalizada para empresas com maior escala.','ACTIVE',true,true,false,4,'Falar com especialista','Personalizado',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT INTO "platform_subscription_plan_prices" ("id","plan_id","interval","amount_cents","valid_from","created_at") VALUES
('12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','MONTHLY',20000,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','YEARLY',199200,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000002','MONTHLY',45000,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000002','YEARLY',448200,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000005','11000000-0000-4000-8000-000000000003','MONTHLY',65000,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000006','11000000-0000-4000-8000-000000000003','YEARLY',647400,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000007','11000000-0000-4000-8000-000000000004','MONTHLY',85000,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('12000000-0000-4000-8000-000000000008','11000000-0000-4000-8000-000000000004','YEARLY',846600,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT INTO "platform_subscription_plan_features" ("id","plan_id","code","label","value_type","value","sort_order") VALUES
('13000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','NFE','Emissão de NF-e e NFS-e','BOOLEAN','true',1),
('13000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','FISCAL_AI','FiscalAI básico','BOOLEAN','true',2),
('13000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000001','DOCUMENTS_LIMIT','Até 100 documentos por mês','INTEGER','100',3),
('13000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000002','FISCAL_AI','FiscalAI corretiva','BOOLEAN','true',1),
('13000000-0000-4000-8000-000000000005','11000000-0000-4000-8000-000000000002','DFE_SYNC','Sincronização DF-e','BOOLEAN','true',2),
('13000000-0000-4000-8000-000000000006','11000000-0000-4000-8000-000000000002','DOCUMENTS_LIMIT','Até 1.000 documentos por mês','INTEGER','1000',3),
('13000000-0000-4000-8000-000000000007','11000000-0000-4000-8000-000000000003','API_WEBHOOKS','API e webhooks','BOOLEAN','true',1),
('13000000-0000-4000-8000-000000000008','11000000-0000-4000-8000-000000000003','DOCUMENTS_LIMIT','Até 5.000 documentos por mês','INTEGER','5000',2),
('13000000-0000-4000-8000-000000000009','11000000-0000-4000-8000-000000000004','MULTI_COMPANY','Gestão multiempresa','BOOLEAN','true',1),
('13000000-0000-4000-8000-000000000010','11000000-0000-4000-8000-000000000004','DOCUMENTS_LIMIT','Até 10.000 documentos por mês','INTEGER','10000',2);
