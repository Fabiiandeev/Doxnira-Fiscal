import assert from "node:assert/strict";
import test from "node:test";
import { actionSchema } from "../../src/modules/fiscal-ai/fiscal-ai.schemas.js";
import { calculateScore, classifyIssue } from "../../src/modules/fiscal-ai/fiscal-ai.service.js";
import {
  askFiscalAi,
  fiscalAiProviderStatus,
  getFiscalAiProviderConfig,
  parseNvidiaResponse,
} from "../../src/modules/fiscal-ai/fiscal-ai.provider.js";

const fiscalFacts = {
  issues: [{ id: "issue-1" }],
  alerts: [],
  products: [{ id: "product-1" }],
  rules: 12,
  documents: 50,
  certificate: {},
  closing: {},
};

test("classifica cada nível de automação sem promover correção insegura", () => {
  assert.equal(classifyIssue({ autoCorrectAvailable: true, severity: "ERROR" }), "AUTO_SAFE");
  assert.equal(classifyIssue({ autoCorrectAvailable: true, severity: "CRITICAL", autoCorrectValue: "x" }), "AUTO_CONFIRM");
  assert.equal(classifyIssue({ severity: "ALERT" }), "MANUAL_GUIDED");
  assert.equal(classifyIssue({ severity: "CRITICAL" }), "ACCOUNTANT_REVIEW");
});

test("exige justificativa para ignorar ocorrência", () => {
  const input = { issueIds: ["b907e45d-39ee-4afd-8127-7e21d97b83e3"], action: "IGNORE" };
  assert.equal(actionSchema.safeParse(input).success, false);
  assert.equal(actionSchema.safeParse({ ...input, justification: "Revisado pelo responsável" }).success, true);
});

test("score é explicável e derivado integralmente dos fatos", () => {
  const result = calculateScore({
    issues: [{}, {}], alerts: [{}], certificate: null, closing: null,
    products: [{}, {}, {}], rules: 0,
  });
  assert.equal(result.score, 440);
  assert.equal(result.components.reduce((sum, component) => sum + component.penalty, 0), 56);
  assert.equal(result.riskLevel, "HIGH");
});

test("configura NVIDIA RAG sem exigir chave para endpoint privado", () => {
  const config = getFiscalAiProviderConfig({
    FISCAL_AI_PROVIDER: "NVIDIA_RAG",
    FISCAL_AI_PROVIDER_URL: "http://rag.internal:8081",
    FISCAL_AI_RAG_COLLECTIONS: "fiscal_public,tenant_rules,fiscal_public",
    FISCAL_AI_RAG_RERANKER_TOP_K: "999",
  });
  assert.equal(config.configured, true);
  assert.deepEqual(config.collections, ["fiscal_public", "tenant_rules"]);
  assert.equal(config.rerankerTopK, 25);
  assert.equal(config.vdbTopK, 15);
  assert.deepEqual(fiscalAiProviderStatus({
    FISCAL_AI_PROVIDER: "NVIDIA_RAG",
    FISCAL_AI_PROVIDER_URL: "http://rag.internal:8081",
  }), {
    configured: true,
    provider: "NVIDIA_RAG",
    knowledgeBaseEnabled: true,
    collectionCount: 1,
  });
});

test("mantém provedor genérico compatível e exige credencial", () => {
  assert.equal(getFiscalAiProviderConfig({
    FISCAL_AI_PROVIDER_URL: "https://provider.example/chat",
  }).configured, false);
  assert.equal(getFiscalAiProviderConfig({
    FISCAL_AI_PROVIDER_URL: "https://provider.example/chat",
    FISCAL_AI_API_KEY: "secret",
  }).configured, true);
});

test("normaliza resposta JSON e SSE do NVIDIA RAG", () => {
  const json = parseNvidiaResponse(JSON.stringify({
    choices: [{ message: { content: "Resposta fundamentada" } }],
    citations: { results: [{ document_name: "MOC_NFE.pdf", score: 0.91 }] },
  }), "application/json");
  assert.deepEqual(json, {
    answer: "Resposta fundamentada",
    confidence: 0.91,
    sources: ["MOC_NFE.pdf"],
  });

  const sse = parseNvidiaResponse([
    'data: {"choices":[{"delta":{"content":"Resposta "}}]}',
    'data: {"choices":[{"delta":{"content":"em fluxo"}}],"citations":{"results":[{"document_name":"SPED.pdf","score":0.8}]}}',
    "data: [DONE]",
  ].join("\n"), "text/event-stream");
  assert.deepEqual(sse, {
    answer: "Resposta em fluxo",
    confidence: 0.8,
    sources: ["SPED.pdf"],
  });
});

test("envia ao NVIDIA RAG somente contexto operacional agregado", async () => {
  let request;
  const result = await askFiscalAi({
    message: "Quais são os riscos?",
    facts: fiscalFacts,
    hasDocumentContext: true,
    conversationHistory: [
      { question: "Há pendências?", answer: "Sim, existe uma pendência cadastral." },
    ],
    environment: {
      FISCAL_AI_PROVIDER: "NVIDIA_RAG",
      FISCAL_AI_PROVIDER_URL: "http://rag.internal:8081",
      FISCAL_AI_RAG_COLLECTIONS: "fiscal_public",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Há um cadastro incompleto." } }],
        citations: { results: [{ document_name: "manual-fiscal.pdf", score: 0.87 }] },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.equal(request.url, "http://rag.internal:8081/v1/generate");
  const payload = JSON.parse(request.options.body);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("companyId"), false);
  assert.equal(serialized.includes("documentId"), false);
  assert.equal(serialized.includes("issue-1"), false);
  assert.equal(serialized.includes("product-1"), false);
  assert.deepEqual(payload.messages.slice(1, 3), [
    { role: "user", content: "Há pendências?" },
    { role: "assistant", content: "Sim, existe uma pendência cadastral." },
  ]);
  assert.equal(payload.use_knowledge_base, true);
  assert.deepEqual(payload.collection_names, ["fiscal_public"]);
  assert.equal(result.answer, "Há um cadastro incompleto.");
  assert.deepEqual(result.sources, ["manual-fiscal.pdf"]);
});
