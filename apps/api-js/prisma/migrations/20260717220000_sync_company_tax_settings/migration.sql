-- Sync company_tax_settings with current Prisma schema.
-- Adds missing columns for Simples Nacional, Lucro Presumido, Lucro Real, and fiscal config.

BEGIN;

ALTER TABLE "company_tax_settings"
  ADD COLUMN "secondary_cnaes" JSONB,
  ADD COLUMN "icms_contrib_type" VARCHAR(20),
  ADD COLUMN "provides_service" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sells_merchandise" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "municipal_registration" VARCHAR(40),
  ADD COLUMN "simples_nominal_rate" DECIMAL(5, 2),
  ADD COLUMN "simples_deduct_amount" DECIMAL(15, 2),
  ADD COLUMN "simples_effective_rate" DECIMAL(5, 2),
  ADD COLUMN "simples_icms_percent" DECIMAL(5, 2),
  ADD COLUMN "simples_iss_percent" DECIMAL(5, 2),
  ADD COLUMN "simples_cpp_percent" DECIMAL(5, 2),
  ADD COLUMN "simples_fator_r" DECIMAL(5, 2),
  ADD COLUMN "simples_revenue_12m" DECIMAL(15, 2),
  ADD COLUMN "simples_payroll_12m" DECIMAL(15, 2),
  ADD COLUMN "simples_manual_override" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "presumido_irpj_base" DECIMAL(5, 2),
  ADD COLUMN "presumido_csll_base" DECIMAL(5, 2),
  ADD COLUMN "presumido_pis_rate" DECIMAL(5, 2),
  ADD COLUMN "presumido_cofins_rate" DECIMAL(5, 2),
  ADD COLUMN "presumido_iss_rate" DECIMAL(5, 2),
  ADD COLUMN "presumido_icms_rate" DECIMAL(5, 2),
  ADD COLUMN "presumido_ipi_rate" DECIMAL(5, 2),
  ADD COLUMN "presumido_rat_percent" DECIMAL(5, 2),
  ADD COLUMN "presumido_third_party" DECIMAL(5, 2),
  ADD COLUMN "presumido_inss_patronal" DECIMAL(5, 2),
  ADD COLUMN "presumido_irpj_vencimento" VARCHAR(20),
  ADD COLUMN "presumido_csll_vencimento" VARCHAR(20),
  ADD COLUMN "real_apuracao_period" VARCHAR(20),
  ADD COLUMN "real_pis_rate" DECIMAL(5, 2),
  ADD COLUMN "real_cofins_rate" DECIMAL(5, 2),
  ADD COLUMN "real_credit_allowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "real_lalur_control" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "real_prejuizo_control" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "real_irpj_rate" DECIMAL(5, 2),
  ADD COLUMN "real_csll_rate" DECIMAL(5, 2),
  ADD COLUMN "fiscal_config_complete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "crt" VARCHAR(2);

COMMIT;