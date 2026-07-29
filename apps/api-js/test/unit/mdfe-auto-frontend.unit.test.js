import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("emissão rápida é o modo inicial e preserva o wizard avançado", async () => {
  const [page, view] = await Promise.all([
    read("apps/web/app/(app)/mdfe/novo/page.tsx"),
    read("apps/web/components/mdfe/mdfe-new-view.tsx"),
  ]);
  assert.match(page, /MdfeNewView/);
  assert.match(view, /useState<"quick" \| "advanced">\("quick"\)/);
  assert.match(view, /<MdfeFormView/);
});

test("frontend envia somente IDs para a preparação automática", async () => {
  const service = await read("apps/web/lib/services/mdfe-service.ts");
  assert.match(service, /JSON\.stringify\(\{ nfeIds \}\)/);
  assert.doesNotMatch(service, /prepareFromNfes:[\s\S]{0,500}totalCargoCents/);
});

test("tela apresenta fila, agrupamento, pendências e transmissão", async () => {
  const view = await read("apps/web/components/mdfe/mdfe-new-view.tsx");
  for (const text of [
    "Documentos aguardando MDF-e",
    "Preparar MDF-e",
    "Salvar e transmitir MDF-e",
    "Revisar detalhes",
    "Limpar seleção",
  ]) assert.match(view, new RegExp(text));
});

test("sucesso da NF-e oferece emissão imediata sem bloquear o fluxo", async () => {
  const view = await read("apps/web/components/emitir-nota/emitir-nota-view.tsx");
  assert.match(view, /Emitir MDF-e agora/);
  assert.match(view, /Adicionar à fila de transporte/);
  assert.match(view, /\/mdfe\/novo\?nfeId=/);
});
