import { randomUUID } from "node:crypto";

import { marketplaceQueue } from "../../config/queue.js";
import { decryptMarketplaceToken, encryptMarketplaceToken } from "./marketplace-crypto.js";
import { MarketplaceError, marketplaceErrorCodes } from "./marketplace-errors.js";
import { createOAuthState, verifyOAuthState } from "./marketplace-oauth-state.js";
import { mercadoLivreAdapter } from "./mercado-livre.adapter.js";
import { marketplaceRepository } from "./marketplace.repository.js";

function connectionNotFound() {
  return new MarketplaceError(
    "Conexão de marketplace não encontrada.",
    marketplaceErrorCodes.CONNECTION_NOT_FOUND,
    404,
  );
}

export function createMarketplaceService({
  repository = marketplaceRepository,
  adapter = mercadoLivreAdapter,
  frontendUrl = process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:3000",
  enqueueSync = process.env.REDIS_DISABLED === "true"
    ? async () => {}
    : (jobId) => marketplaceQueue.add("limited-sync", { jobId }, { jobId: `marketplace:${jobId}` }),
} = {}) {
  async function requireConnection(companyId, connectionId, options) {
    const connection = await repository.findConnection(companyId, connectionId, options);
    if (!connection) throw connectionNotFound();
    return connection;
  }

  async function runSync(connection, job) {
    try {
      await repository.updateSyncJob(job.id, { status: "running", startedAt: new Date() });
      const accessToken = decryptMarketplaceToken(connection.accessToken);
      const account = await adapter.getAccount(accessToken);
      const [listings, orders] = await Promise.all([
        adapter.listListings(accessToken, account.id, { limit: 20, maxPages: 1 }),
        adapter.listOrders(accessToken, account.id, { limit: 20, maxPages: 1 }),
      ]);
      let listingsUpserted = 0;
      let ordersUpserted = 0;
      for (const listingReference of listings.slice(0, 20)) {
        const listing = typeof listingReference === "object"
          ? listingReference
          : await adapter.getListing(accessToken, listingReference);
        await repository.upsertListing({
          companyId: connection.companyId,
          connectionId: connection.id,
          providerListingId: String(listing.id),
          sku: listing.seller_custom_field ?? listing.seller_sku ?? null,
          title: listing.title ?? null,
          status: listing.status ?? null,
          price: listing.price == null ? null : String(listing.price),
          currency: listing.currency_id ?? null,
          rawPayload: listing,
          syncedAt: new Date(),
        });
        listingsUpserted += 1;
      }
      for (const orderReference of orders.slice(0, 20)) {
        const order = typeof orderReference === "object"
          ? orderReference
          : await adapter.getOrder(accessToken, orderReference);
        await repository.upsertOrder({
          companyId: connection.companyId,
          connectionId: connection.id,
          providerOrderId: String(order.id),
          status: order.status ?? null,
          currency: order.currency_id ?? null,
          totalAmount: String(order.total_amount ?? 0),
          freightAmount: String(order.shipping?.cost ?? 0),
          discountAmount: String(order.coupon?.amount ?? 0),
          orderedAt: order.date_created ? new Date(order.date_created) : new Date(),
          rawPayload: order,
          items: (order.order_items ?? []).map((item) => ({
            providerItemId: String(item.item?.id ?? item.id),
            sku: item.item?.seller_sku ?? null,
            title: item.item?.title ?? null,
            quantity: Number(item.quantity ?? 0),
            unitPrice: String(item.unit_price ?? 0),
            totalAmount: String(Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)),
            rawPayload: item,
          })),
        });
        ordersUpserted += 1;
      }
      await repository.createSyncEvent({
        companyId: connection.companyId,
        connectionId: connection.id,
        syncJobId: job.id,
        type: "LIMITED_SYNC_COMPLETED",
        payload: { listings: listingsUpserted, orders: ordersUpserted, limit: 20 },
      });
      await repository.updateSyncJob(job.id, { status: "completed", finishedAt: new Date() });
      return { listings: listingsUpserted, orders: ordersUpserted };
    } catch (error) {
      await repository.updateSyncJob(job.id, {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return {
    listConnections(companyId) {
      return repository.listConnections(companyId);
    },

    getConnection(companyId, connectionId) {
      return requireConnection(companyId, connectionId);
    },

    beginMercadoLivreConnection(companyId, userId) {
      const state = createOAuthState({ companyId, userId });
      return adapter.getAuthorizationUrl(state);
    },

    async completeMercadoLivreConnection(code, state) {
      const stateData = verifyOAuthState(state);
      const tokens = await adapter.exchangeAuthorizationCode(code);
      const account = await adapter.getAccount(tokens.access_token);
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
        : null;
      const connection = await repository.upsertConnection({
        companyId: stateData.companyId,
        provider: "mercado_livre",
        name: account.nickname ?? `Mercado Livre ${account.id}`,
        status: "connected",
        externalAccountId: String(account.id),
        accessToken: encryptMarketplaceToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptMarketplaceToken(tokens.refresh_token) : null,
        tokenExpiresAt: expiresAt,
        connectedAt: new Date(),
        metadata: { userId: stateData.userId },
      });
      return { connection, redirectUrl: `${frontendUrl}/commerce/marketplaces?oauth=success` };
    },

    async testConnection(companyId, connectionId) {
      const connection = await requireConnection(companyId, connectionId, { includeSecrets: true });
      try {
        return await adapter.testConnection(decryptMarketplaceToken(connection.accessToken));
      } catch (error) {
        if (error?.code !== marketplaceErrorCodes.TOKEN_EXPIRED || !connection.refreshToken) throw error;
        try {
          const tokens = await adapter.refreshAccessToken(decryptMarketplaceToken(connection.refreshToken));
          const accessToken = encryptMarketplaceToken(tokens.access_token);
          const refreshToken = tokens.refresh_token
            ? encryptMarketplaceToken(tokens.refresh_token)
            : connection.refreshToken;
          await repository.updateTokens(companyId, connectionId, {
            accessToken,
            refreshToken,
            tokenExpiresAt: tokens.expires_in
              ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
              : connection.tokenExpiresAt,
            status: "connected",
          });
          return adapter.testConnection(tokens.access_token);
        } catch (refreshError) {
          await repository.updateTokens(companyId, connectionId, {
            status: "reauthorization_required",
          });
          throw refreshError;
        }
      }
    },

    async startSync(companyId, connectionId, idempotencyKey = randomUUID()) {
      await requireConnection(companyId, connectionId);
      const result = await repository.createSyncJob({ companyId, connectionId, idempotencyKey, type: "LIMITED" });
      if (result.running) {
        throw new MarketplaceError(
          "Já existe uma sincronização completa em andamento.",
          marketplaceErrorCodes.SYNC_ALREADY_RUNNING,
          409,
        );
      }
      if (result.idempotent) return result.job;
      await enqueueSync(result.job.id);
      return result.job;
    },

    async executeSyncJob(jobId) {
      const job = await repository.findSyncJob(jobId);
      if (!job?.connection || job.status === "completed") return null;
      return runSync(job.connection, job);
    },

    async disconnect(companyId, connectionId) {
      await requireConnection(companyId, connectionId);
      await repository.disconnect(companyId, connectionId);
    },

    async processWebhook(payload) {
      const event = adapter.handleWebhook(payload);
      if (!event.userId) return { accepted: true, matched: false };
      const connection = await repository.findByExternalAccount("mercado_livre", event.userId);
      if (!connection) return { accepted: true, matched: false };
      await repository.recordWebhook({
        companyId: connection.companyId,
        connectionId: connection.id,
        providerEventId: event.providerEventId,
        topic: event.topic,
        payload: event.payload,
      });
      return { accepted: true, matched: true };
    },
  };
}

export const marketplaceService = createMarketplaceService();
