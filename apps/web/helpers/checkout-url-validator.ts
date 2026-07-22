const ALLOWED_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_CHECKOUT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Valida uma URL de checkout público.
 *
 * Regras:
 * - sempre HTTPS (ou http em localhost para desenvolvimento);
 * - nunca schemes perigosos (javascript:, data:, file:, etc.);
 * - host deve estar na allowlist quando CHECKOUT_ALLOWED_HOSTS está definido;
 * - URLs relativas são rejeitadas (não há Auth para path absoluto aqui).
 */
export function isSafeCheckoutUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === "https:") {
    // ok
  } else if (protocol === "http:") {
    const host = parsed.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") return false;
  } else {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_HOSTS.size === 0) return true;
  return ALLOWED_HOSTS.has(host);
}
