import { Client } from "pg";
const c = new Client({ connectionString: "postgresql://postgres.dcjsxfobvpqtaygafksi:PHFABIAN%40%402008@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true" });
await c.connect();
const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='clients' ORDER BY ordinal_position");
console.log(r.rows.map(x => x.column_name).join(", "));
await c.end();
