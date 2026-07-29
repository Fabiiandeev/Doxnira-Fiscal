import { createMarketplaceHttpClient } from "./marketplace.adapter.js";

const API_URL = "https://api.mercadolibre.com";
const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

function requiredConfig(config = {}) {
  const resolved = {
    clientId: config.clientId ?? process.env.MERCADO_LIVRE_CLIENT_ID,
    clientSecret: config.clientSecret ?? process.env.MERCADO_LIVRE_CLIENT_SECRET,
    redirectUri: config.redirectUri ?? process.env.MERCADO_LIVRE_REDIRECT_URI,
  };
  if (!resolved.clientId || !resolved.clientSecret || !resolved.redirectUri) {
    throw new Error("Mercado Livre OAuth environment variables are required.");
  }
  return resolved;
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

export function createMercadoLivreAdapter({ fetchImpl, timeoutMs, config } = {}) {
  const request = createMarketplaceHttpClient({ fetchImpl, timeoutMs });

  async function tokenRequest(params) {
    const { data } = await request(`${API_URL}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    return data;
  }

  async function paginated(path, accessToken, { limit = 50, maxPages = 20 } = {}) {
    const items = [];
    let offset = 0;
    for (let page = 0; page < maxPages; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const { data } = await request(`${API_URL}${path}${separator}limit=${limit}&offset=${offset}`, {
        headers: bearer(accessToken),
      });
      const pageItems = data?.results ?? [];
      items.push(...pageItems);
      offset += pageItems.length;
      const total = data?.paging?.total ?? items.length;
      if (!pageItems.length || offset >= total) break;
    }
    return items;
  }

  return {
    getAuthorizationUrl(state) {
      const oauth = requiredConfig(config);
      const url = new URL(AUTH_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", oauth.clientId);
      url.searchParams.set("redirect_uri", oauth.redirectUri);
      url.searchParams.set("state", state);
      return url.toString();
    },

    exchangeAuthorizationCode(code) {
      const oauth = requiredConfig(config);
      return tokenRequest({
        grant_type: "authorization_code",
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        code,
        redirect_uri: oauth.redirectUri,
      });
    },

    refreshAccessToken(refreshToken) {
      const oauth = requiredConfig(config);
      return tokenRequest({
        grant_type: "refresh_token",
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        refresh_token: refreshToken,
      });
    },

    async getAccount(accessToken) {
      return (await request(`${API_URL}/users/me`, { headers: bearer(accessToken) })).data;
    },

    listListings(accessToken, sellerId, options) {
      return paginated(`/users/${encodeURIComponent(sellerId)}/items/search`, accessToken, options);
    },

    async getListing(accessToken, listingId) {
      return (await request(`${API_URL}/items/${encodeURIComponent(listingId)}`, { headers: bearer(accessToken) })).data;
    },

    listOrders(accessToken, sellerId, options) {
      return paginated(`/orders/search?seller=${encodeURIComponent(sellerId)}`, accessToken, options);
    },

    async getOrder(accessToken, orderId) {
      return (await request(`${API_URL}/orders/${encodeURIComponent(orderId)}`, { headers: bearer(accessToken) })).data;
    },

    async testConnection(accessToken) {
      const account = await this.getAccount(accessToken);
      return { success: true, accountId: String(account.id), nickname: account.nickname ?? null };
    },

    handleWebhook(payload) {
      return {
        providerEventId: String(payload.id ?? payload.resource ?? `${payload.topic}:${payload.sent ?? ""}`),
        topic: payload.topic ?? null,
        userId: payload.user_id ? String(payload.user_id) : null,
        payload,
      };
    },
  };
}

export const mercadoLivreAdapter = createMercadoLivreAdapter();
