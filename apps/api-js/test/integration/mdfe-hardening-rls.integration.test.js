import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import pg from "pg";

const { Client } = pg;

test("RLS MDF-e isola empresas pelo usuário autenticado", async () => {
  const securedTables = [
    "fiscal_establishments", "drivers", "fleet_vehicles", "mdfe_operational_settings",
    "nfe_authorized_events", "mdfe_drafts", "mdfe_loading_municipalities",
    "mdfe_route_states", "mdfe_unloading_cities", "mdfe_vehicles", "mdfe_trailers",
    "mdfe_drivers", "mdfe_fiscal_document_links", "mdfe_contractors", "mdfe_ciots",
    "mdfe_toll_vouchers", "mdfe_payments", "mdfe_payment_components",
    "mdfe_insurances", "mdfe_insurance_endorsements", "mdfe_seals",
    "mdfe_validation_runs", "mdfe_validation_issues", "mdfe_events",
    "mdfe_transmission_attempts", "mdfe_xml_artifacts", "mdfe_audit_logs",
    "mdfe_nfe_eligibilities", "mdfe_nfe_eligibility_history", "mdfe_nfe_reservations",
  ];
  const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const role = `mdfe_rls_${suffix}`;
  const userOne = randomUUID();
  const userTwo = randomUUID();
  const companyOne = randomUUID();
  const companyTwo = randomUUID();
  await client.connect();
  try {
    await client.query(`CREATE ROLE "${role}" NOLOGIN`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON drivers TO "${role}"`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_current_user_id() TO "${role}"`);
    await client.query(`GRANT EXECUTE ON FUNCTION app_has_company_access(uuid) TO "${role}"`);
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, 'RLS One', $2, 'test', 'OWNER', now(), now()),
              ($3, 'RLS Two', $4, 'test', 'OWNER', now(), now())`,
      [userOne, `rls-one-${suffix}@example.test`, userTwo, `rls-two-${suffix}@example.test`],
    );
    await client.query(
      `INSERT INTO companies (
         id, owner_id, legal_name, cnpj, environment, status, created_at, updated_at
       ) VALUES
         ($1, $2, 'RLS Company One', $3, 'homologation', 'active', now(), now()),
         ($4, $5, 'RLS Company Two', $6, 'homologation', 'active', now(), now())`,
      [companyOne, userOne, `11${suffix.padEnd(12, "1")}`.slice(0, 14), companyTwo, userTwo, `22${suffix.padEnd(12, "2")}`.slice(0, 14)],
    );
    await client.query(
      `INSERT INTO drivers (id, company_id, name, cpf, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Driver One', '11111111111', now(), now()),
              (gen_random_uuid(), $2, 'Driver Two', '22222222222', now(), now())`,
      [companyOne, companyTwo],
    );

    const policyState = await client.query(
      `SELECT requested.table_name, c.relrowsecurity,
              count(p.policyname)::int AS policies
       FROM unnest($1::text[]) AS requested(table_name)
       LEFT JOIN pg_class c ON c.relname = requested.table_name
       LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
       GROUP BY requested.table_name, c.relrowsecurity
       ORDER BY requested.table_name`,
      [securedTables],
    );
    assert.equal(policyState.rows.length, securedTables.length);
    assert.deepEqual(
      policyState.rows.filter((row) => row.relrowsecurity !== true || row.policies !== 1),
      [],
    );

    await client.query(`SET ROLE "${role}"`);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userOne]);
    const visibleToOne = await client.query("SELECT company_id, name FROM drivers ORDER BY name");
    assert.deepEqual(visibleToOne.rows, [{ company_id: companyOne, name: "Driver One" }]);

    await assert.rejects(
      client.query(
        `INSERT INTO drivers (id, company_id, name, cpf, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'Cross Tenant', '33333333333', now(), now())`,
        [companyTwo],
      ),
      /row-level security policy/i,
    );

    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userTwo]);
    const visibleToTwo = await client.query("SELECT company_id, name FROM drivers ORDER BY name");
    assert.deepEqual(visibleToTwo.rows, [{ company_id: companyTwo, name: "Driver Two" }]);
  } finally {
    await client.query("RESET ROLE").catch(() => {});
    await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [[companyOne, companyTwo]]).catch(() => {});
    await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[userOne, userTwo]]).catch(() => {});
    await client.query(`DROP OWNED BY "${role}"`).catch(() => {});
    await client.query(`DROP ROLE IF EXISTS "${role}"`).catch(() => {});
    await client.end();
  }
});
