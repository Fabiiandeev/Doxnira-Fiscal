import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL ausente para auditoria.");

const target = new URL(connectionString);
console.log(`External datasource (masked): host=${target.hostname}; database=${target.pathname.slice(1)}; schema=${target.searchParams.get("schema") || "public"}`);

const client = new pg.Client({ connectionString, statement_timeout: 15_000 });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const migration = await client.query("SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM \"_prisma_migrations\" WHERE migration_name = $1 ORDER BY started_at DESC", ["20260713090000_align_products_with_prisma_schema"]);
  const recent = await client.query("SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count FROM \"_prisma_migrations\" ORDER BY started_at DESC LIMIT 20");
  const columns = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' ORDER BY ordinal_position");
  const indexes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'products' ORDER BY indexname");
  console.log(JSON.stringify({ migration: migration.rows, recent: recent.rows, columns: columns.rows, indexes: indexes.rows }, null, 2));
  await client.query("COMMIT");
} finally {
  await client.end();
}
