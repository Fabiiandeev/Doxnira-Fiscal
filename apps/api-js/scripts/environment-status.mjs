import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const environments = {
  development: ".env",
  test: ".env.test",
  homologation: process.env.HOMOLOGATION_ENV_FILE || ".env.homologation",
  production: process.env.PRODUCTION_ENV_FILE || ".env.production",
};
const catalog = [
  ["DATABASE_URL","Banco",true],["REDIS_URL","Filas",true],["JWT_SECRET","Autenticação",true],
  ["CERT_ENCRYPTION_KEY","Certificado",true],["MARKETPLACE_TOKEN_ENCRYPTION_KEY","Marketplaces",true],
  ["CORS_ORIGIN","API",true],["NEXT_PUBLIC_APP_URL","Web",true],["NEXT_PUBLIC_API_URL","Web",true],
  ["MERCADO_LIVRE_CLIENT_ID","Mercado Livre",false],["MERCADO_LIVRE_CLIENT_SECRET","Mercado Livre",false],["MERCADO_LIVRE_REDIRECT_URI","Mercado Livre",false],
  ["SHOPEE_PARTNER_ID","Shopee",false],["SHOPEE_PARTNER_KEY","Shopee",false],["SHOPEE_REDIRECT_URI","Shopee",false],
  ["FISCAL_AI_PROVIDER_URL","FiscalAI",false],["FISCAL_AI_API_KEY","FiscalAI",false],
  ["NFCE_PROVIDER_URL","NFC-e",false],["NFCE_PROVIDER_TOKEN","NFC-e",false],["NFSE_PROVIDER_URL","NFS-e",false],["NFSE_PROVIDER_TOKEN","NFS-e",false],
  ["MDFE_PROVIDER_URL","MDF-e",false],["MDFE_PROVIDER_TOKEN","MDF-e",false],
  ["SICOOB_CLIENT_ID","Sicoob",false],["SICOOB_CLIENT_SECRET","Sicoob",false],["SICOOB_CERTIFICATE_PATH","Sicoob",false],["SICOOB_PRIVATE_KEY_PATH","Sicoob",false],
  ["SMTP_HOST","E-mail",false],["SMTP_USER","E-mail",false],["SMTP_PASSWORD","E-mail",false],
  ["STORAGE_PROVIDER","Storage",false],["STORAGE_BUCKET","Storage",false],["WEBHOOK_PUBLIC_URL","Webhooks",false],
];
async function configuredKeys(file) {
  try {
    const content = await readFile(resolve(process.cwd(), file), "utf8");
    const result = new Set();
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/);
      if (!match) continue;
      const raw = match[2].trim().replace(/^["']|["']$/g, "");
      if (raw && !/change.?me|replace.?with|example|test\.invalid/i.test(raw)) result.add(match[1]);
    }
    return result;
  } catch { return new Set(); }
}
console.log("| Variável | Módulo | Obrigatória | Ambiente | Estado | Validação necessária |");
console.log("|---|---|---:|---|---|---|");
for (const [environment, file] of Object.entries(environments)) {
  const present = await configuredKeys(file);
  for (const [name, module, required] of catalog) {
    const configured = present.has(name);
    console.log(`| ${name} | ${module} | ${required ? "sim" : "condicional"} | ${environment} | ${configured ? "configurada" : "ausente"} | ${configured ? "validar conectividade sem revelar valor" : "configurar no secret manager"} |`);
  }
}
