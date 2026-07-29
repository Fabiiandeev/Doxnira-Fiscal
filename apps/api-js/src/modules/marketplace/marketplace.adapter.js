import { MarketplaceError, marketplaceErrorCodes } from "./marketplace-errors.js";

export function createMarketplaceHttpClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");

  return async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }
      if (response.ok) return { data, headers: response.headers, status: response.status };
      const message = data?.message || data?.error_description || "Marketplace request failed.";
      if (response.status === 401) throw new MarketplaceError(message, marketplaceErrorCodes.TOKEN_EXPIRED, 401);
      if (response.status === 403) throw new MarketplaceError(message, marketplaceErrorCodes.PERMISSION_DENIED, 403);
      if (response.status === 404) throw new MarketplaceError(message, marketplaceErrorCodes.RESOURCE_NOT_FOUND, 404);
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        throw new MarketplaceError(message, marketplaceErrorCodes.RATE_LIMITED, 429, [{ retryAfter }]);
      }
      throw new MarketplaceError(message, marketplaceErrorCodes.PROVIDER_UNAVAILABLE, 502);
    } catch (error) {
      if (error instanceof MarketplaceError) throw error;
      const message = error?.name === "AbortError"
        ? "Marketplace request timed out."
        : "Marketplace provider is unavailable.";
      throw new MarketplaceError(message, marketplaceErrorCodes.PROVIDER_UNAVAILABLE, 503);
    } finally {
      clearTimeout(timeout);
    }
  };
}
