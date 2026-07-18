import test from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../../src/utils/app-error.js";

// Testamos a logica de validacao pura (sem dependencias de banco)
// usando apenas os helpers de validacao exportados indiretamente via modulo
import { resolveTargetFromRequestParams } from "../../src/modules/accountant/accountant-document-target.service.js";

test("resolveTargetFromRequestParams retorna fiscalDocumentId para FISCAL", () => {
  const request = { params: { documentId: "doc-nfe-123" } };
  const result = resolveTargetFromRequestParams(request, { kind: "FISCAL" });
  assert.equal(result.fiscalDocumentId, "doc-nfe-123");
  assert.equal(result.transportDocumentId, null);
});

test("resolveTargetFromRequestParams retorna transportDocumentId para TRANSPORT", () => {
  const request = { params: { documentId: "doc-cte-456" } };
  const result = resolveTargetFromRequestParams(request, { kind: "TRANSPORT" });
  assert.equal(result.transportDocumentId, "doc-cte-456");
  assert.equal(result.fiscalDocumentId, null);
});

test("resolveTargetFromRequestParams rejeita kind invalido", () => {
  const request = { params: { documentId: "x" } };
  assert.throws(() => resolveTargetFromRequestParams(request, { kind: "INVALID" }), { code: "ACCOUNTANT_UNSUPPORTED_KIND" });
});

test("auditEntityFromTarget retorna entityType correto para FISCAL", async () => {
  const { auditEntityFromTarget } = await import("../../src/modules/accountant/accountant-document-target.service.js");
  const result = auditEntityFromTarget({ kind: "FISCAL", documentId: "a" });
  assert.equal(result.entityType, "FiscalDocument");
  assert.equal(result.entityId, "a");
});

test("auditEntityFromTarget retorna entityType correto para TRANSPORT", async () => {
  const { auditEntityFromTarget } = await import("../../src/modules/accountant/accountant-document-target.service.js");
  const result = auditEntityFromTarget({ kind: "TRANSPORT", documentId: "b" });
  assert.equal(result.entityType, "TransportDocument");
  assert.equal(result.entityId, "b");
});