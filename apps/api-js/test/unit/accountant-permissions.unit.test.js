import test from "node:test";
import assert from "node:assert/strict";

import { hasAccountantPermission } from "../../src/middlewares/accountant-company-access.middleware.js";
import { canDownloadAccountantXml } from "../../src/modules/accountant/accountant-document-detail.service.js";

test("grant FULL mantém compatibilidade para download de XML", () => {
  assert.equal(hasAccountantPermission({ accountantContext: { access: { accessLevel: "FULL", permissions: [] } } }, "fiscal.documents.download_xml"), true);
});

test("permissão granular libera download sem grant FULL", () => {
  assert.equal(hasAccountantPermission({ accountantContext: { access: { accessLevel: "READ_ONLY", permissions: ["fiscal.documents.download_xml"] } } }, "fiscal.documents.download_xml"), true);
});

test("leitura sem permissão granular não libera download", () => {
  assert.equal(hasAccountantPermission({ accountantContext: { access: { accessLevel: "READ_ONLY", permissions: ["fiscal.documents.read"] } } }, "fiscal.documents.download_xml"), false);
});

test("download exige XML completo e autorização granular ou FULL", () => {
  assert.equal(canDownloadAccountantXml("FULL", true), true);
  assert.equal(canDownloadAccountantXml("FULL", false), false);
  assert.equal(canDownloadAccountantXml("SUMMARY", true), false);
  assert.equal(canDownloadAccountantXml("MISSING", true), false);
});

test("permissões granulares não se confundem entre leitura e mutações", () => {
  const request = { accountantContext: { access: { accessLevel: "READ_ONLY", permissions: ["fiscal.documents.read"] } } };
  assert.equal(hasAccountantPermission(request, "fiscal.documents.read"), true);
  assert.equal(hasAccountantPermission(request, "fiscal.documents.manage_notes"), false);
  assert.equal(hasAccountantPermission(request, "fiscal.documents.manage_tags"), false);
  assert.equal(hasAccountantPermission(request, "accountant.requests.create"), false);
  assert.equal(hasAccountantPermission(request, "fiscal.documents.review"), false);
});
