const TEST_DATABASE_PATTERN = /(test|testing|ci)/i;

export function testDatabaseSafetyError() {
  return new Error("TEST_DATABASE_SAFETY_CHECK_FAILED: DATABASE_URL_TEST ausente ou banco não identificado como ambiente de teste.");
}

export function enforceTestDatabaseEnvironment(runtimeEnv = process.env) {
  if (runtimeEnv.NODE_ENV !== "test") return null;
  const databaseUrl = runtimeEnv.DATABASE_URL_TEST;
  if (!databaseUrl) throw testDatabaseSafetyError();

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw testDatabaseSafetyError();
  }

  const database = parsed.pathname.replace(/^\//, "");
  const schema = parsed.searchParams.get("schema") || "public";
  if (!TEST_DATABASE_PATTERN.test(database) && !TEST_DATABASE_PATTERN.test(schema)) {
    throw testDatabaseSafetyError();
  }
  if (runtimeEnv.DIRECT_URL) throw testDatabaseSafetyError();

  runtimeEnv.DATABASE_URL = databaseUrl;
  return { host: parsed.hostname, database, schema };
}
