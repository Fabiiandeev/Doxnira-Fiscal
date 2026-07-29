import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditPayload } from "../../src/modules/settings/settings.service.js";
import { certificateStatus } from "../../src/modules/settings/certificate.service.js";

test("auditoria sanitiza secrets recursivamente", () => {
  const value = sanitizeAuditPayload({ token: "x", nested: { password: "y", name: "ok" }, certificate: "bytes" });
  assert.deepEqual(value, { token: "[REDACTED]", nested: { password: "[REDACTED]", name: "ok" }, certificate: "[REDACTED]" });
});
test("status do certificado deriva da validade real", () => {
  assert.equal(certificateStatus(null), "NOT_CONFIGURED");
  assert.equal(certificateStatus({ status: "revoked" }), "REVOKED");
  assert.equal(certificateStatus({ status: "active", validUntil: new Date(Date.now() - 86400000) }), "EXPIRED");
  assert.equal(certificateStatus({ status: "active", validUntil: new Date(Date.now() + 10 * 86400000) }), "EXPIRING");
  assert.equal(certificateStatus({ status: "active", validUntil: new Date(Date.now() + 60 * 86400000) }), "VALID");
});
