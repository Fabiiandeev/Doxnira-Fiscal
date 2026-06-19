import { createHash } from "node:crypto";

export function hashXml(xml) {
  return createHash("sha256").update(String(xml)).digest("hex");
}
