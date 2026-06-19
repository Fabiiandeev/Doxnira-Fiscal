import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "../config/env.js";

const key = createHash("sha256").update(env.CERT_ENCRYPTION_KEY).digest();

export function encryptBuffer(buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptBuffer(payload) {
  const buffer = Buffer.from(payload);
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function encryptText(value) {
  return encryptBuffer(Buffer.from(String(value), "utf8")).toString("base64");
}

export function decryptText(value) {
  return decryptBuffer(Buffer.from(String(value), "base64")).toString("utf8");
}
