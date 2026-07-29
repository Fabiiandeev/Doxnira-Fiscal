import assert from "node:assert/strict";
import test from "node:test";

import { splitMarkdown } from "./fiscal-ai-rag-ingest.mjs";

test("splitMarkdown preserva conteúdo curto em um chunk", () => {
  assert.deepEqual(splitMarkdown("# Título\n\nConteúdo fiscal."), [
    "# Título\n\nConteúdo fiscal.",
  ]);
});

test("splitMarkdown divide conteúdo longo respeitando o limite", () => {
  const chunks = splitMarkdown(`## Seção\n\n${"fiscal ".repeat(100)}`, 160, 20);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 160));
});

test("splitMarkdown ignora conteúdo vazio", () => {
  assert.deepEqual(splitMarkdown(" \r\n "), []);
});
