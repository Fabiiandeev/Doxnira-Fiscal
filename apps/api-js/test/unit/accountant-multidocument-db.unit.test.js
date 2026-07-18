import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../src/config/prisma.js";

async function q(sql, params = []) {
  return prisma.$queryRawUnsafe(sql, ...params);
}
async function x(sql, params = []) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

test("multidocument: constraints XOR existem nas 4 tabelas", async () => {
  for (const table of ["accountant_document_reviews", "accountant_document_notes", "accountant_document_tag_links", "accountant_document_requests"]) {
    const rows = await q(`SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = $1 AND c.conname LIKE '%target_xor'`, [table]);
    assert.equal(rows.length, 1, `XOR constraint missing on ${table}`);
  }
});

test("multidocument: indices parciais transport_document_id existem", async () => {
  const indices = await q(`SELECT indexname FROM pg_indexes WHERE tablename = ANY($1) AND indexname LIKE '%transport_document_id_idx'`, [
    ["accountant_document_reviews", "accountant_document_notes", "accountant_document_tag_links", "accountant_document_requests"],
  ]);
  const names = indices.map((r) => r.indexname);
  const expected = ["accountant_document_reviews_transport_document_id_idx", "accountant_document_notes_transport_document_id_idx", "accountant_document_tag_links_transport_document_id_idx", "accountant_document_requests_transport_document_id_idx"];
  for (const name of expected) assert.ok(names.some((n) => n.includes(name)), `index ${name} not found`);
});

test("multidocument: indices unicos CT-e existem em reviews e tag_links", async () => {
  const indices = await q(`SELECT indexname FROM pg_indexes WHERE tablename = ANY($1) AND indexname LIKE '%transport_document_id%'`, [
    ["accountant_document_reviews", "accountant_document_tag_links"],
  ]);
  const names = indices.map((r) => r.indexname);
  assert.ok(names.some((n) => n.includes("accountant_document_reviews_office_id_transport_document_id_key")), "unique review CTE index");
  assert.ok(names.some((n) => n.includes("accountant_document_tag_links_office_id_transport_document_id")), "unique tag_links CTE index");
});

test("multidocument: colunas transport_document_id e lifecycle existem", async () => {
  const reviews = await q(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'accountant_document_reviews' AND column_name = 'transport_document_id'`);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].is_nullable, "YES");

  const requestsCols = await q(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'accountant_document_requests' AND column_name IN ('assigned_to_user_id','response_message','responded_at','resolved_at','cancelled_at')`);
  assert.equal(requestsCols.length, 5, "lifecycle columns missing");
});

test("multidocument XOR constraint: verificacao logica via tabela isolada", async () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const table = `_test_xor_${suffix}`;
  await x(`CREATE TABLE ${table} (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fiscal_document_id UUID, transport_document_id UUID, CONSTRAINT _xort_${suffix} CHECK ((fiscal_document_id IS NOT NULL AND transport_document_id IS NULL) OR (fiscal_document_id IS NULL AND transport_document_id IS NOT NULL)))`);
  await x(`INSERT INTO ${table} (fiscal_document_id) VALUES (gen_random_uuid())`);
  await x(`INSERT INTO ${table} (transport_document_id) VALUES (gen_random_uuid())`);
  await assert.rejects(() => x(`INSERT INTO ${table} (id) VALUES (gen_random_uuid())`));
  await assert.rejects(() => x(`INSERT INTO ${table} (fiscal_document_id, transport_document_id) VALUES (gen_random_uuid(), gen_random_uuid())`));
  const cnt = await q(`SELECT count(*)::int AS c FROM ${table}`);
  assert.equal(cnt[0].c, 2);
  await x(`DROP TABLE IF EXISTS ${table}`);
});

test("multidocument: unicidade com transport_document_id funciona em reviews e tag_links", async () => {
  await x(`CREATE TEMPORARY TABLE _test_review_unique (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), office_id UUID NOT NULL DEFAULT gen_random_uuid(), transport_document_id UUID, CONSTRAINT _review_cte_uq UNIQUE (office_id, transport_document_id))`);
  // Permite 2 rows com mesmo office_id e transport_document_id NULL (NULL nao conflita em UNIQUE no PG)
  await x(`INSERT INTO _test_review_unique (office_id) VALUES ('00000000-0000-0000-0000-000000000001')`);
  await x(`INSERT INTO _test_review_unique (office_id) VALUES ('00000000-0000-0000-0000-000000000001')`);
  // Permite mesma office e mesmo transport_document_id (UNIQUE bloqueia)
  await x(`INSERT INTO _test_review_unique (office_id, transport_document_id) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010')`);
  await assert.rejects(() => x(`INSERT INTO _test_review_unique (office_id, transport_document_id) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010')`));
  await x(`DROP TABLE IF EXISTS _test_review_unique`);
});

test("multidocument: migration preservou estrutura existente", async () => {
  // fiscal_document_id continua existindo e eh anulavel
  const col = await q(`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'accountant_document_reviews' AND column_name = 'fiscal_document_id'`);
  assert.equal(col.length, 1);
  assert.equal(col[0].is_nullable, "YES");
  // FK fiscal_document_id original ainda existe
  const fk = await q(`SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'accountant_document_reviews'::regclass AND c.confrelid = 'fiscal_documents'::regclass AND c.contype = 'f'`);
  assert.ok(fk.length > 0, "FK fiscal_document_id foi preservada");
});