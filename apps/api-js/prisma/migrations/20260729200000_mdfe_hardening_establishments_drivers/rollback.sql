BEGIN;

DO $$
DECLARE
  table_name text;
  all_secured_tables text[] := ARRAY[
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
  previously_unsecured_tables text[] := ARRAY[
    'mdfe_drafts', 'mdfe_loading_municipalities', 'mdfe_route_states',
    'mdfe_unloading_cities', 'mdfe_vehicles', 'mdfe_trailers', 'mdfe_drivers',
    'mdfe_fiscal_document_links', 'mdfe_contractors', 'mdfe_ciots',
    'mdfe_toll_vouchers', 'mdfe_payments', 'mdfe_payment_components',
    'mdfe_insurances', 'mdfe_insurance_endorsements', 'mdfe_seals',
    'mdfe_validation_runs', 'mdfe_validation_issues', 'mdfe_events',
    'mdfe_transmission_attempts', 'mdfe_xml_artifacts', 'mdfe_audit_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY all_secured_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_company_isolation ON %I', table_name);
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY previously_unsecured_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS "nfe_documents_assign_default_establishment" ON "nfe_documents";
DROP TRIGGER IF EXISTS "mdfe_drafts_assign_default_establishment" ON "mdfe_drafts";
DROP TRIGGER IF EXISTS "mdfe_nfe_eligibilities_assign_default_establishment" ON "mdfe_nfe_eligibilities";
DROP TRIGGER IF EXISTS "companies_create_headquarters_establishment" ON "companies";
DROP FUNCTION IF EXISTS "assign_default_establishment"();
DROP FUNCTION IF EXISTS "create_company_headquarters_establishment"();

ALTER TABLE "nfe_documents" DROP CONSTRAINT IF EXISTS "nfe_documents_establishment_id_fkey";
ALTER TABLE "mdfe_drafts" DROP CONSTRAINT IF EXISTS "mdfe_drafts_establishment_id_fkey";
ALTER TABLE "mdfe_nfe_eligibilities" DROP CONSTRAINT IF EXISTS "mdfe_nfe_eligibilities_establishment_id_fkey";
ALTER TABLE "nfe_documents" DROP COLUMN IF EXISTS "establishment_id";
ALTER TABLE "mdfe_drafts" DROP COLUMN IF EXISTS "establishment_id";
ALTER TABLE "mdfe_nfe_eligibilities" DROP COLUMN IF EXISTS "establishment_id";

DROP TABLE IF EXISTS "nfe_authorized_events";
DROP TABLE IF EXISTS "mdfe_operational_settings";
DROP TABLE IF EXISTS "fleet_vehicles";
DROP TABLE IF EXISTS "drivers";
DROP TABLE IF EXISTS "fiscal_establishments";
DROP FUNCTION IF EXISTS "app_has_company_access"(uuid);
DROP FUNCTION IF EXISTS "app_current_user_id"();

COMMIT;
