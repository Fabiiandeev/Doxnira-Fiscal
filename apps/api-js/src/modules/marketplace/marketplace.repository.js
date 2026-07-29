import { prisma } from "../../config/prisma.js";

const publicConnectionSelect = {
  id: true,
  companyId: true,
  provider: true,
  name: true,
  status: true,
  externalAccountId: true,
  tokenExpiresAt: true,
  connectedAt: true,
  lastSyncAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

export function createMarketplaceRepository(prismaClient = prisma) {
  const inTransaction = (operation) =>
    typeof prismaClient.$transaction === "function"
      ? prismaClient.$transaction(operation)
      : operation(prismaClient);

  return {
    listConnections(companyId) {
      return prismaClient.marketplaceConnection.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: publicConnectionSelect,
      });
    },

    findConnection(companyId, connectionId, { includeSecrets = false } = {}) {
      return prismaClient.marketplaceConnection.findFirst({
        where: { id: connectionId, companyId },
        ...(includeSecrets ? {} : { select: publicConnectionSelect }),
      });
    },

    findByExternalAccount(provider, externalAccountId, { includeSecrets = false } = {}) {
      return prismaClient.marketplaceConnection.findFirst({
        where: { provider, externalAccountId },
        ...(includeSecrets ? {} : { select: publicConnectionSelect }),
      });
    },

    upsertConnection(data) {
      return prismaClient.marketplaceConnection.upsert({
        where: {
          companyId_provider_externalAccountId: {
            companyId: data.companyId,
            provider: data.provider,
            externalAccountId: data.externalAccountId,
          },
        },
        create: data,
        update: data,
        select: publicConnectionSelect,
      });
    },

    disconnect(companyId, connectionId) {
      return prismaClient.marketplaceConnection.updateMany({
        where: { id: connectionId, companyId },
        data: {
          status: "disabled",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        },
      });
    },

    updateTokens(companyId, connectionId, data) {
      return prismaClient.marketplaceConnection.updateMany({
        where: { id: connectionId, companyId },
        data,
      });
    },

    createSyncJob({ companyId, connectionId, idempotencyKey, type = "FULL" }) {
      return inTransaction(async (transaction) => {
        const existing = await transaction.marketplaceSyncJob.findUnique({
          where: { idempotencyKey },
        });
        if (existing) return { job: existing, idempotent: true };
        const running = await transaction.marketplaceSyncJob.findFirst({
          where: { companyId, connectionId, type, status: { in: ["queued", "running"] } },
          select: { id: true },
        });
        if (running) return { running };
        const job = await transaction.marketplaceSyncJob.create({
          data: { companyId, connectionId, idempotencyKey, type, status: "queued" },
        });
        return { job };
      });
    },

    updateSyncJob(jobId, data) {
      return prismaClient.marketplaceSyncJob.update({ where: { id: jobId }, data });
    },

    findSyncJob(jobId) {
      return prismaClient.marketplaceSyncJob.findUnique({
        where: { id: jobId },
        include: { connection: true },
      });
    },

    createSyncEvent(data) {
      return prismaClient.marketplaceSyncEvent.create({ data });
    },

    upsertCursor(data) {
      return prismaClient.marketplaceSyncCursor.upsert({
        where: {
          connectionId_resourceType: {
            connectionId: data.connectionId,
            resourceType: data.resourceType,
          },
        },
        create: data,
        update: {
          cursor: data.cursor,
          lastSyncedAt: data.lastSyncedAt,
        },
      });
    },

    upsertListing(data) {
      return prismaClient.marketplaceListingLink.upsert({
        where: {
          connectionId_providerListingId: {
            connectionId: data.connectionId,
            providerListingId: data.providerListingId,
          },
        },
        create: data,
        update: {
          sku: data.sku,
          title: data.title,
          status: data.status,
          price: data.price,
          currency: data.currency,
          rawPayload: data.rawPayload,
          syncedAt: data.syncedAt,
        },
      });
    },

    upsertOrder({ items = [], ...data }) {
      return inTransaction(async (transaction) => {
        const order = await transaction.marketplaceOrder.upsert({
          where: {
            connectionId_providerOrderId: {
              connectionId: data.connectionId,
              providerOrderId: data.providerOrderId,
            },
          },
          create: data,
          update: {
            status: data.status,
            currency: data.currency,
            totalAmount: data.totalAmount,
            freightAmount: data.freightAmount,
            discountAmount: data.discountAmount,
            orderedAt: data.orderedAt,
            rawPayload: data.rawPayload,
          },
        });
        for (const item of items) {
          await transaction.marketplaceOrderItem.upsert({
            where: {
              orderId_providerItemId: {
                orderId: order.id,
                providerItemId: item.providerItemId,
              },
            },
            create: { ...item, orderId: order.id, companyId: data.companyId },
            update: {
              sku: item.sku,
              title: item.title,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount,
              rawPayload: item.rawPayload,
            },
          });
        }
        return transaction.marketplaceOrder.findFirst({
          where: { id: order.id, companyId: data.companyId },
          include: { items: true },
        });
      });
    },

    recordWebhook(data) {
      return prismaClient.marketplaceWebhookEvent.upsert({
        where: {
          connectionId_providerEventId: {
            connectionId: data.connectionId,
            providerEventId: data.providerEventId,
          },
        },
        create: data,
        update: {},
      });
    },
  };
}

export const marketplaceRepository = createMarketplaceRepository();
