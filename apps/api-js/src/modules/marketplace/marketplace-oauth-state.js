import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { MarketplaceError, marketplaceErrorCodes } from "./marketplace-errors.js";

const usedNonces = new Map();

function secret(value = process.env.JWT_SECRET) {
  if (!value || value.length < 32) throw new Error("OAuth state signing key is required.");
  return value;
}

function signature(payload, signingSecret) {
  return createHmac("sha256", secret(signingSecret)).update(payload).digest("base64url");
}

export function createOAuthState({ companyId, userId, ttlMs = 10 * 60_000, now = Date.now(), signingSecret } = {}) {
  if (!companyId || !userId) throw new TypeError("companyId and userId are required.");
  const data = {
    nonce: randomBytes(24).toString("base64url"),
    companyId,
    userId,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${signature(payload, signingSecret)}`;
}

export function verifyOAuthState(state, { now = Date.now(), signingSecret, consume = true } = {}) {
  const [payload, providedSignature] = String(state || "").split(".");
  if (!payload || !providedSignature) {
    throw new MarketplaceError("OAuth state inválido.", marketplaceErrorCodes.OAUTH_STATE_INVALID, 400);
  }
  const expected = signature(payload, signingSecret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new MarketplaceError("OAuth state inválido.", marketplaceErrorCodes.OAUTH_STATE_INVALID, 400);
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new MarketplaceError("OAuth state inválido.", marketplaceErrorCodes.OAUTH_STATE_INVALID, 400);
  }
  if (data.expiresAt <= now) {
    throw new MarketplaceError("OAuth state expirado.", marketplaceErrorCodes.OAUTH_STATE_EXPIRED, 400);
  }
  for (const [nonce, expiresAt] of usedNonces) if (expiresAt <= now) usedNonces.delete(nonce);
  if (usedNonces.has(data.nonce)) {
    throw new MarketplaceError("OAuth state já utilizado.", marketplaceErrorCodes.OAUTH_STATE_INVALID, 400);
  }
  if (consume) usedNonces.set(data.nonce, data.expiresAt);
  return data;
}
