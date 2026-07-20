"use strict";

function formatResults(results) {
  const ok = results.every((r) => r && r.pass);
  const lines = ["Preflight:", ""];
  for (const r of results) {
    lines.push(`  [${r.pass ? "OK" : "FAIL"}] ${r.label}`);
    if (r.detail) lines.push(`        ${r.detail}`);
  }
  lines.push("");
  return { ok, text: lines.join("\n") };
}

module.exports = { formatResults };
