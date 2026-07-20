import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.test", override: true });
const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST ausente");

const databaseName = new URL(url).pathname.replace(/^\//, "");
if (!/(test|testing|ci)/i.test(databaseName)) throw new Error(`Banco inseguro: ${databaseName}`);

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const result = await client.query("SELECT current_database() AS database, current_user AS user_name, current_schema() AS schema_name");
  console.log(result.rows[0]);
} finally {
  await client.end();
}
