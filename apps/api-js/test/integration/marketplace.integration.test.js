import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { disconnectDatabase, prisma } from "../../src/config/prisma.js";
import {
  decryptMarketplaceToken,
  encryptMarketplaceToken,
} from "../../src/modules/marketplace/marketplace-crypto.js";
import { createMarketplaceRepository } from "../../src/modules/marketplace/marketplace.repository.js";

after(async () => {
  await disconnectDatabase();
});

test("Marketplace persiste dados isolados, idempotentes e sem expor tokens", async () => {
  const [identity] = await prisma.$queryRaw`
    SELECT current_database() AS database, current_user AS user_name, current_schema() AS schema_name
  `;
  assert.equal(identity.database, "ns_fiscal_cloud_test");
  assert.equal(identity.user_name, "ns_fiscal_app");
  assert.equal(identity.schema_name, "public");

  const fixtureId = randomUUID();
  const rollback = new Error("ROLLBACK_MARKETPLACE_FIXTURES");
  let assertionsCompleted = false;

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const repository = createMarketplaceRepository(transaction);
      const user = await transaction.user.create({
        data: {
          name: "Marketplace Integration",
          email: `marketplace-${fixtureId}@test.invalid`,
          passwordHash: "not-a-real-password",
        },
      });
      const company = await transaction.company.create({
        data: {
          ownerId: user.id,
          legalName: "Marketplace Test Company",
          cnpj: fixtureId.replaceAll("-", "").slice(0, 14).replace(/\D/g, "1"),
        },
      });
      const otherCompany = await transaction.company.create({
        data: {
          ownerId: user.id,
          legalName: "Marketplace Other Company",
          cnpj: fixtureId.replaceAll("-", "").slice(14, 28).replace(/\D/g, "2"),
        },
      });

      const encryptionKey = "integration-test-key-material-32";
      const encryptedAccessToken = encryptMarketplaceToken("temporary-access-token", encryptionKey);
      const encryptedRefreshToken = encryptMarketplaceToken("temporary-refresh-token", encryptionKey);
      assert.notEqual(encryptedAccessToken, "temporary-access-token");
      assert.equal(
        decryptMarketplaceToken(encryptedAccessToken, encryptionKey),
        "temporary-access-token",
      );

      const connection = await repository.upsertConnection({
        companyId: company.id,
        provider: "mercado_livre",
        name: "Conta simulada",
        status: "connected",
        externalAccountId: `account-${fixtureId}`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        connectedAt: new Date(),
        metadata: {},
      });
      assert.equal("accessToken" in connection, false);
      assert.equal("refreshToken" in connection, false);

      const listed = await repository.listConnections(company.id);
      assert.equal(listed.length, 1);
      assert.equal("accessToken" in listed[0], false);
      assert.equal(await repository.findConnection(otherCompany.id, connection.id), null);

      const firstJob = await repository.createSyncJob({
        companyId: company.id,
        connectionId: connection.id,
        idempotencyKey: `full-${fixtureId}`,
      });
      assert.ok(firstJob.job);
      const concurrentJob = await repository.createSyncJob({
        companyId: company.id,
        connectionId: connection.id,
        idempotencyKey: `full-concurrent-${fixtureId}`,
      });
      assert.equal(concurrentJob.running.id, firstJob.job.id);

      await repository.createSyncEvent({
        companyId: company.id,
        connectionId: connection.id,
        syncJobId: firstJob.job.id,
        type: "FULL_SYNC_TEST",
        payload: { simulated: true },
      });
      await repository.updateSyncJob(firstJob.job.id, {
        status: "completed",
        startedAt: new Date(),
        finishedAt: new Date(),
      });

      const listingData = {
        companyId: company.id,
        connectionId: connection.id,
        providerListingId: `listing-${fixtureId}`,
        sku: "SKU-TEST",
        title: "Anúncio simulado",
        status: "active",
        price: "129.90",
        currency: "BRL",
        rawPayload: { simulated: true },
        syncedAt: new Date(),
      };
      await repository.upsertListing(listingData);
      await repository.upsertListing({ ...listingData, price: "119.90" });
      assert.equal(
        await transaction.marketplaceListingLink.count({
          where: { connectionId: connection.id, providerListingId: listingData.providerListingId },
        }),
        1,
      );

      const orderData = {
        companyId: company.id,
        connectionId: connection.id,
        providerOrderId: `order-${fixtureId}`,
        status: "paid",
        currency: "BRL",
        totalAmount: "119.90",
        freightAmount: "0",
        discountAmount: "0",
        orderedAt: new Date(),
        rawPayload: { simulated: true },
        items: [{
          providerItemId: `item-${fixtureId}`,
          sku: "SKU-TEST",
          title: "Item simulado",
          quantity: 1,
          unitPrice: "119.90",
          totalAmount: "119.90",
          rawPayload: { simulated: true },
        }],
      };
      await repository.upsertOrder(orderData);
      await repository.upsertOrder(orderData);
      assert.equal(
        await transaction.marketplaceOrder.count({
          where: { connectionId: connection.id, providerOrderId: orderData.providerOrderId },
        }),
        1,
      );
      assert.equal(await transaction.marketplaceOrderItem.count({ where: { companyId: company.id } }), 1);

      const webhookData = {
        companyId: company.id,
        connectionId: connection.id,
        providerEventId: `webhook-${fixtureId}`,
        topic: "orders_v2",
        payload: { simulated: true },
      };
      await repository.recordWebhook(webhookData);
      await repository.recordWebhook(webhookData);
      assert.equal(
        await transaction.marketplaceWebhookEvent.count({
          where: { connectionId: connection.id, providerEventId: webhookData.providerEventId },
        }),
        1,
      );

      await repository.disconnect(company.id, connection.id);
      const disconnected = await repository.findConnection(company.id, connection.id, {
        includeSecrets: true,
      });
      assert.equal(disconnected.status, "disabled");
      assert.equal(disconnected.accessToken, null);
      assert.equal(disconnected.refreshToken, null);

      assertionsCompleted = true;
      throw rollback;
    }),
    (error) => error === rollback,
  );

  assert.equal(assertionsCompleted, true);
  assert.equal(await prisma.company.count({ where: { legalName: "Marketplace Test Company" } }), 0);
});
