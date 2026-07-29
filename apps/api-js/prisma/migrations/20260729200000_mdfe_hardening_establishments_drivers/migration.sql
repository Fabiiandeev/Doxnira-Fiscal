BEGIN;

CREATE TABLE "fiscal_establishments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "legal_name" VARCHAR(255) NOT NULL,
  "trade_name" VARCHAR(255),
  "tax_id" VARCHAR(20) NOT NULL,
  "state_registration" VARCHAR(40),
  "municipal_registration" VARCHAR(40),
  "city_code" VARCHAR(7),
  "city" VARCHAR(120),
  "state" CHAR(2),
  "postal_code" VARCHAR(8),
  "street" VARCHAR(255),
  "number" VARCHAR(30),
  "complement" VARCHAR(120),
  "district" VARCHAR(120),
  "is_headquarters" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "certificate_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_establishments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_establishments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fiscal_establishments_certificate_id_fkey"
    FOREIGN KEY ("certificate_id") REFERENCES "digital_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fiscal_establishments_company_id_code_key"
  ON "fiscal_establishments"("company_id", "code");
CREATE UNIQUE INDEX "fiscal_establishments_company_id_tax_id_key"
  ON "fiscal_establishments"("company_id", "tax_id");
CREATE UNIQUE INDEX "fiscal_establishments_one_headquarters_per_company"
  ON "fiscal_establishments"("company_id") WHERE "is_headquarters";
CREATE INDEX "fiscal_establishments_company_id_is_active_idx"
  ON "fiscal_establishments"("company_id", "is_active");

INSERT INTO "fiscal_establishments" (
  "id", "company_id", "code", "legal_name", "trade_name", "tax_id",
  "state_registration", "city", "state", "is_headquarters", "is_active",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), c."id", 'MATRIZ', c."legal_name", c."trade_name", c."cnpj",
  c."state_registration", c."city", c."uf", true, c."status" = 'active',
  c."created_at", CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "fiscal_establishments" e WHERE e."company_id" = c."id"
);

CREATE OR REPLACE FUNCTION "create_company_headquarters_establishment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "fiscal_establishments" (
    "company_id", "code", "legal_name", "trade_name", "tax_id",
    "state_registration", "city", "state", "is_headquarters", "is_active"
  ) VALUES (
    NEW."id", 'MATRIZ', NEW."legal_name", NEW."trade_name", NEW."cnpj",
    NEW."state_registration", NEW."city", NEW."uf", true, NEW."status" = 'active'
  )
  ON CONFLICT ("company_id", "code") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "companies_create_headquarters_establishment"
AFTER INSERT ON "companies"
FOR EACH ROW EXECUTE FUNCTION "create_company_headquarters_establishment"();

CREATE TABLE "drivers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "cpf" VARCHAR(11) NOT NULL,
  "phone" VARCHAR(20),
  "license" VARCHAR(30),
  "license_type" VARCHAR(10),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "drivers_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "drivers_cpf_check" CHECK ("cpf" ~ '^[0-9]{11}$')
);

CREATE UNIQUE INDEX "drivers_company_id_cpf_key" ON "drivers"("company_id", "cpf");
CREATE INDEX "drivers_company_id_is_active_deleted_at_idx"
  ON "drivers"("company_id", "is_active", "deleted_at");

CREATE TABLE "fleet_vehicles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "plate" VARCHAR(7) NOT NULL,
  "plate_state" CHAR(2),
  "renavam" VARCHAR(20),
  "rntrc" VARCHAR(20),
  "tare_weight" DECIMAL(15,3),
  "capacity_kg" DECIMAL(15,3),
  "capacity_m3" DECIMAL(15,3),
  "wheel_type" VARCHAR(30),
  "body_type" VARCHAR(30),
  "owner_type" VARCHAR(30),
  "owner_name" VARCHAR(255),
  "owner_cpf_cnpj" VARCHAR(20),
  "owner_state_registration" VARCHAR(40),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fleet_vehicles_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fleet_vehicles_plate_check" CHECK ("plate" ~ '^[A-Z]{3}[0-9A-Z][0-9][0-9A-Z][0-9]$')
);

CREATE UNIQUE INDEX "fleet_vehicles_company_id_plate_key"
  ON "fleet_vehicles"("company_id", "plate");
CREATE INDEX "fleet_vehicles_company_id_is_active_deleted_at_idx"
  ON "fleet_vehicles"("company_id", "is_active", "deleted_at");

CREATE TABLE "mdfe_operational_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "establishment_id" UUID,
  "default_vehicle_id" UUID,
  "default_driver_id" UUID,
  "default_series" VARCHAR(10) NOT NULL DEFAULT '1',
  "issuer_type" VARCHAR(30) NOT NULL DEFAULT 'TRANSPORTADOR_CARGA_PROPRIA',
  "carrier_type" VARCHAR(30) NOT NULL DEFAULT 'PROPRIO',
  "modal" VARCHAR(30) NOT NULL DEFAULT 'RODOVIARIO',
  "environment" "Environment",
  "route_provider" VARCHAR(80) NOT NULL DEFAULT 'DETERMINISTIC_IBGE',
  "quick_mode_enabled" BOOLEAN NOT NULL DEFAULT true,
  "rntrc" VARCHAR(20),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mdfe_operational_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mdfe_operational_settings_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mdfe_operational_settings_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "fiscal_establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mdfe_operational_settings_default_vehicle_id_fkey"
    FOREIGN KEY ("default_vehicle_id") REFERENCES "fleet_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "mdfe_operational_settings_default_driver_id_fkey"
    FOREIGN KEY ("default_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mdfe_operational_settings_company_id_establishment_id_key"
  ON "mdfe_operational_settings"("company_id", "establishment_id");
CREATE UNIQUE INDEX "mdfe_operational_settings_one_global_per_company"
  ON "mdfe_operational_settings"("company_id") WHERE "establishment_id" IS NULL;
CREATE INDEX "mdfe_operational_settings_company_id_is_active_idx"
  ON "mdfe_operational_settings"("company_id", "is_active");

ALTER TABLE "nfe_documents" ADD COLUMN "establishment_id" UUID;
ALTER TABLE "mdfe_drafts" ADD COLUMN "establishment_id" UUID;
ALTER TABLE "mdfe_nfe_eligibilities" ADD COLUMN "establishment_id" UUID;

UPDATE "nfe_documents" n
SET "establishment_id" = e."id"
FROM "fiscal_establishments" e
WHERE e."company_id" = n."company_id" AND e."is_headquarters"
  AND n."establishment_id" IS NULL;

UPDATE "mdfe_drafts" m
SET "establishment_id" = e."id"
FROM "fiscal_establishments" e
WHERE e."company_id" = m."company_id" AND e."is_headquarters"
  AND m."establishment_id" IS NULL;

UPDATE "mdfe_nfe_eligibilities" m
SET "establishment_id" = COALESCE(n."establishment_id", e."id"),
    "establishment_key" = COALESCE(n."establishment_id", e."id")::text
FROM "nfe_documents" n
LEFT JOIN "fiscal_establishments" e
  ON e."company_id" = n."company_id" AND e."is_headquarters"
WHERE n."id" = m."nfe_document_id";

ALTER TABLE "nfe_documents"
  ADD CONSTRAINT "nfe_documents_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "fiscal_establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mdfe_drafts"
  ADD CONSTRAINT "mdfe_drafts_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "fiscal_establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mdfe_nfe_eligibilities"
  ADD CONSTRAINT "mdfe_nfe_eligibilities_establishment_id_fkey"
  FOREIGN KEY ("establishment_id") REFERENCES "fiscal_establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "nfe_documents_company_id_establishment_id_idx"
  ON "nfe_documents"("company_id", "establishment_id");
CREATE INDEX "mdfe_drafts_company_id_establishment_id_status_idx"
  ON "mdfe_drafts"("company_id", "establishment_id", "status");
CREATE INDEX "mdfe_nfe_eligibilities_company_id_establishment_id_status_idx"
  ON "mdfe_nfe_eligibilities"("company_id", "establishment_id", "status");

CREATE OR REPLACE FUNCTION "assign_default_establishment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."establishment_id" IS NULL THEN
    SELECT e."id" INTO NEW."establishment_id"
    FROM "fiscal_establishments" e
    WHERE e."company_id" = NEW."company_id" AND e."is_headquarters" AND e."is_active"
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "nfe_documents_assign_default_establishment"
BEFORE INSERT ON "nfe_documents"
FOR EACH ROW EXECUTE FUNCTION "assign_default_establishment"();
CREATE TRIGGER "mdfe_drafts_assign_default_establishment"
BEFORE INSERT ON "mdfe_drafts"
FOR EACH ROW EXECUTE FUNCTION "assign_default_establishment"();
CREATE TRIGGER "mdfe_nfe_eligibilities_assign_default_establishment"
BEFORE INSERT ON "mdfe_nfe_eligibilities"
FOR EACH ROW EXECUTE FUNCTION "assign_default_establishment"();

CREATE TABLE "nfe_authorized_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" VARCHAR(160) NOT NULL,
  "company_id" UUID NOT NULL,
  "establishment_id" UUID,
  "nfe_document_id" UUID NOT NULL,
  "access_key" VARCHAR(44) NOT NULL,
  "protocol" VARCHAR(80) NOT NULL,
  "environment" VARCHAR(1) NOT NULL,
  "source" VARCHAR(30) NOT NULL DEFAULT 'SEFAZ',
  "authorized_at" TIMESTAMP(3) NOT NULL,
  "xml_artifact_id" UUID,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nfe_authorized_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nfe_authorized_events_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "nfe_authorized_events_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "fiscal_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "nfe_authorized_events_nfe_document_id_fkey"
    FOREIGN KEY ("nfe_document_id") REFERENCES "nfe_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "nfe_authorized_events_event_id_key" ON "nfe_authorized_events"("event_id");
CREATE UNIQUE INDEX "nfe_authorized_events_nfe_document_id_protocol_key"
  ON "nfe_authorized_events"("nfe_document_id", "protocol");
CREATE INDEX "nfe_authorized_events_company_id_status_authorized_at_idx"
  ON "nfe_authorized_events"("company_id", "status", "authorized_at");
CREATE INDEX "nfe_authorized_events_establishment_id_status_idx"
  ON "nfe_authorized_events"("establishment_id", "status");

CREATE OR REPLACE FUNCTION "app_current_user_id"()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.sub', true) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    THEN current_setting('request.jwt.claim.sub', true)::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION "app_has_company_access"(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "companies" c
    WHERE c."id" = target_company_id
      AND c."owner_id" = "app_current_user_id"()
  )
$$;

DO $$
DECLARE
  table_name text;
  secured_tables text[] := ARRAY[
    'fiscal_establishments', 'drivers', 'fleet_vehicles', 'mdfe_operational_settings',
    'nfe_authorized_events', 'mdfe_drafts', 'mdfe_loading_municipalities',
    'mdfe_route_states', 'mdfe_unloading_cities', 'mdfe_vehicles', 'mdfe_trailers',
    'mdfe_drivers', 'mdfe_fiscal_document_links', 'mdfe_contractors', 'mdfe_ciots',
    'mdfe_toll_vouchers', 'mdfe_payments', 'mdfe_payment_components',
    'mdfe_insurances', 'mdfe_insurance_endorsements', 'mdfe_seals',
    'mdfe_validation_runs', 'mdfe_validation_issues', 'mdfe_events',
    'mdfe_transmission_attempts', 'mdfe_xml_artifacts', 'mdfe_audit_logs',
    'mdfe_nfe_eligibilities', 'mdfe_nfe_eligibility_history', 'mdfe_nfe_reservations'
  ];
BEGIN
  FOREACH table_name IN ARRAY secured_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_company_isolation ON %I', table_name);
      EXECUTE format(
        'CREATE POLICY tenant_company_isolation ON %I FOR ALL TO PUBLIC USING ("app_has_company_access"("company_id")) WITH CHECK ("app_has_company_access"("company_id"))',
        table_name
      );
      EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', table_name);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT ALL ON TABLE %I TO service_role', table_name);
      END IF;
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION "app_current_user_id"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app_has_company_access"(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION "app_current_user_id"() TO authenticated;
    GRANT EXECUTE ON FUNCTION "app_has_company_access"(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION "app_current_user_id"() TO service_role;
    GRANT EXECUTE ON FUNCTION "app_has_company_access"(uuid) TO service_role;
  END IF;
END
$$;

COMMIT;
