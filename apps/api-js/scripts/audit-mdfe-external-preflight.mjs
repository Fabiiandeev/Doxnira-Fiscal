import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL ausente para auditoria.");

const target = new URL(connectionString);
console.log(`MDF-e external preflight (masked): host=${target.hostname}; database=${target.pathname.slice(1)}; schema=${target.searchParams.get("schema") || "public"}`);

const expectedMigrations = [
  "20260729153000_complete_mdfe_module",
  "20260729160000_mdfe_automatic_from_nfe",
  "20260729200000_mdfe_hardening_establishments_drivers",
  "20260729203000_fix_fleet_vehicle_plate_check",
];
const expectedTables = [
  "mdfe_drafts",
  "mdfe_nfe_eligibilities",
  "mdfe_nfe_reservations",
  "fiscal_establishments",
  "drivers",
  "fleet_vehicles",
  "mdfe_operational_settings",
  "nfe_authorized_events",
];

const client = new pg.Client({ connectionString, statement_timeout: 15_000 });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const migrations = await client.query(
    `SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
     FROM "_prisma_migrations"
     WHERE migration_name = ANY($1::text[])
     ORDER BY migration_name`,
    [expectedMigrations],
  );
  const unfinished = await client.query(
    `SELECT migration_name, started_at, applied_steps_count
     FROM "_prisma_migrations"
     WHERE finished_at IS NULL AND rolled_back_at IS NULL
     ORDER BY started_at`,
  );
  const tables = await client.query(
    `SELECT expected.table_name,
            to_regclass('public.' || expected.table_name) IS NOT NULL AS exists,
            COALESCE(c.relrowsecurity, false) AS rls_enabled,
            count(p.policyname)::int AS policy_count
     FROM unnest($1::text[]) AS expected(table_name)
     LEFT JOIN pg_class c ON c.relname = expected.table_name
     LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
     GROUP BY expected.table_name, c.relrowsecurity
     ORDER BY expected.table_name`,
    [expectedTables],
  );
  const certificateTable = await client.query(
    "SELECT to_regclass('public.digital_certificates') IS NOT NULL AS exists",
  );
  const certificateSummary = certificateTable.rows[0].exists
    ? (await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'active')::int AS active,
              count(*) FILTER (
                WHERE status = 'active' AND validated_at IS NOT NULL AND valid_until > now()
              )::int AS active_validated_unexpired
       FROM digital_certificates`,
    )).rows[0]
    : { total: 0, active: 0, active_validated_unexpired: 0 };
  const present = new Set(migrations.rows.map((row) => row.migration_name));
  console.log(JSON.stringify({
    target: {
      host: target.hostname,
      database: target.pathname.slice(1),
      schema: target.searchParams.get("schema") || "public",
    },
    expectedMigrations: expectedMigrations.map((name) => ({
      name,
      present: present.has(name),
    })),
    migrationRows: migrations.rows,
    unfinishedMigrations: unfinished.rows,
    tables: tables.rows,
    certificateSummary: {
      tableExists: certificateTable.rows[0].exists,
      ...certificateSummary,
      homologationUsabilityVerified: false,
    },
    backupVerified: false,
    writePerformed: false,
  }, null, 2));
  await client.query("COMMIT");
} finally {
  await client.end();
}
