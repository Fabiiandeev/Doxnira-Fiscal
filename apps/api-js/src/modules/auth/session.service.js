import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { redis } from "../../config/redis.js";

export const SESSION_COOKIE_BASE_NAME = "ns-fiscal-token";
export const CSRF_COOKIE_NAME = "ns-fiscal-csrf";
export const sessionCookieName = env.NODE_ENV === "production" && !env.SESSION_COOKIE_DOMAIN
  ? `__Host-${SESSION_COOKIE_BASE_NAME}`
  : SESSION_COOKIE_BASE_NAME;

const cookieOptions = {
  httpOnly: true,
  secure: env.SESSION_COOKIE_SECURE,
  sameSite: env.SESSION_COOKIE_SAME_SITE,
  path: "/",
  ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
  maxAge: env.SESSION_TTL_SECONDS * 1000,
};

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

export function issueSession(user) {
  const jti = randomUUID();
  const token = jwt.sign({ role: user.role, email: user.email, jti }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.SESSION_TTL_SECONDS,
  });
  const csrfToken = createHmac("sha256", env.CSRF_SECRET).update(`${jti}:${user.id}`).digest("base64url");
  return { token, jti, csrfToken };
}

export function setSessionCookies(response, session) {
  if (sessionCookieName !== SESSION_COOKIE_BASE_NAME) response.clearCookie(SESSION_COOKIE_BASE_NAME, { path: "/" });
  response.cookie(sessionCookieName, session.token, cookieOptions);
  response.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
    httpOnly: false, secure: env.SESSION_COOKIE_SECURE, sameSite: env.SESSION_COOKIE_SAME_SITE,
    path: "/", ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
    maxAge: env.SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(response) {
  response.clearCookie(sessionCookieName, cookieOptions);
  response.clearCookie(CSRF_COOKIE_NAME, { ...cookieOptions, httpOnly: false });
  if (sessionCookieName !== SESSION_COOKIE_BASE_NAME) response.clearCookie(SESSION_COOKIE_BASE_NAME, { path: "/" });
}

export function sessionTokenFromRequest(request) {
  const cookies = parseCookies(request);
  const cookieToken = cookies[sessionCookieName];
  if (cookieToken) return { token: cookieToken, transport: "cookie" };
  const [scheme, token] = String(request.get("authorization") || "").split(" ");
  return scheme === "Bearer" && token ? { token, transport: "bearer" } : { token: null, transport: null };
}

export async function revokeSession(payload) {
  if (!payload?.jti || !payload?.exp) return;
  const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  await redis.set(`session:revoked:${payload.jti}`, "1", "EX", ttl);
}

export async function isSessionRevoked(payload) {
  return payload?.jti ? Boolean(await redis.get(`session:revoked:${payload.jti}`)) : false;
}

export function csrfMatches(payload, token) {
  if (!payload?.jti || !payload?.sub || !token) return false;
  const expected = createHmac("sha256", env.CSRF_SECRET).update(`${payload.jti}:${payload.sub}`).digest("base64url");
  const actual = Buffer.from(String(token)); const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
