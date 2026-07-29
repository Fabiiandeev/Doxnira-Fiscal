const api = process.env.SMOKE_API_URL;
const web = process.env.SMOKE_WEB_URL;
if (!api || !web) throw new Error("SMOKE_API_URL e SMOKE_WEB_URL são obrigatórias.");
const token = process.env.SMOKE_READONLY_TOKEN;
const companyId = process.env.SMOKE_COMPANY_ID;
const checks = [
  ["landing", `${web}/`, false], ["login", `${web}/login`, false], ["health", `${api}/health`, false],
  ["dashboard", companyId ? `${api}/companies/${companyId}/dashboard` : null, true],
  ["clientes", companyId ? `${api}/companies/${companyId}/clients` : null, true],
  ["produtos", companyId ? `${api}/companies/${companyId}/products` : null, true],
  ["documentos", companyId ? `${api}/companies/${companyId}/documents` : null, true],
  ["configurações", companyId ? `${api}/companies/${companyId}/settings` : null, true],
];
let failed = false;
for (const [name, url, authenticated] of checks) {
  if (!url) { console.log(`SKIP ${name}: contexto somente leitura ausente`); continue; }
  const response = await fetch(url, { method: "GET", redirect: "manual", headers: authenticated && token ? { authorization: `Bearer ${token}` } : {} });
  const ok = response.ok || (!token && authenticated && response.status === 401) || (!authenticated && response.status === 307);
  console.log(`${ok ? "OK" : "FAIL"} ${name}: HTTP ${response.status}`);
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
