import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(rawKey = process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY) {
  if (!rawKey || rawKey.length < 32) {
    throw new Error("MARKETPLACE_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return createHash("sha256").update(rawKey, "utf8").digest();
}

export function encryptMarketplaceToken(value, rawKey) {
  if (typeof value !== "string" || !value) throw new TypeError("Token is required.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(rawKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMarketplaceToken(value, rawKey) {
  const [ivPart, tagPart, encryptedPart] = String(value).split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Invalid encrypted token.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(rawKey),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
