import pg from "pg";

const DIRECT_URL = "postgresql://postgres:PHFABIAN%40%402008@db.dcjsxfobvpqtaygafksi.supabase.co:5432/postgres";

const COLUMNS = [
  ["barcode", "VARCHAR(20)"],
  ["brand", "VARCHAR(160)"],
  ["weight", "DECIMAL(10,4)"],
  ["length", "DECIMAL(10,4)"],
  ["width", "DECIMAL(10,4)"],
  ["height", "DECIMAL(10,4)"],
  ["ncm_description", "VARCHAR(500)"],
  ["ex_tipi", "VARCHAR(10)"],
  ["origem_mercadoria", "SMALLINT"],
  ["anp", "VARCHAR(20)"],
  ["tipo_item", "SMALLINT"],
  ["grupo_tributario", "VARCHAR(80)"],
  ["cst_csosn_padrao", "VARCHAR(10)"],
  ["cfop_interno", "VARCHAR(10)"],
  ["cfop_externo", "VARCHAR(10)"],
  ["cfop_devolucao", "VARCHAR(10)"],
  ["cfop_remessa", "VARCHAR(10)"],
  ["cfop_bonificacao", "VARCHAR(10)"],
  ["cfop_transferencia", "VARCHAR(10)"],
  ["icms_padrao", "DECIMAL(5,2)"],
  ["icms_st_padrao", "DECIMAL(5,2)"],
  ["mva_padrao", "DECIMAL(5,2)"],
  ["ipi_padrao", "DECIMAL(5,2)"],
  ["pis_padrao", "DECIMAL(5,2)"],
  ["cofins_padrao", "DECIMAL(5,2)"],
  ["iss_padrao", "DECIMAL(5,2)"],
  ["beneficio_fiscal_cod", "VARCHAR(30)"],
  ["beneficio_red_base", "DECIMAL(5,2)"],
  ["beneficio_diferimento", "BOOLEAN DEFAULT FALSE"],
  ["beneficio_isencao", "BOOLEAN DEFAULT FALSE"],
  ["obs_fiscal", "VARCHAR(500)"],
  ["cost_price", "DECIMAL(15,2)"],
  ["stock_min", "INTEGER"],
  ["stock_max", "INTEGER"],
  ["fiscal_ai", "JSONB"],
  ["score_produto", "INTEGER"],
  ["historico_json", "JSONB"],
];

async function migrate() {
  const client = new pg.Client({ connectionString: DIRECT_URL });
  await client.connect();

  for (const [col, type] of COLUMNS) {
    try {
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      console.log("OK:", col);
    } catch (e) {
      console.log("SKIP:", col, e.message);
    }
  }

  try {
    await client.query(
      "CREATE INDEX IF NOT EXISTS products_company_id_ncm_idx ON products (company_id, ncm)"
    );
    console.log("OK: ncm index");
  } catch (e) {
    console.log("SKIP: ncm index", e.message);
  }

  await client.end();
  console.log("Migration complete.");
}

migrate();
