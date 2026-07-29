import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import IORedis from "ioredis";

import { RedisRateLimitStore, rateLimit } from "../../src/middlewares/rate-limit.middleware.js";

async function startApi(redisClient, route) {
  const app = express();
  app.post(route, rateLimit({ policy: "AUTH_STRICT", store: new RedisRateLimitStore(redisClient) }), (_request, response) => response.sendStatus(204));
  app.use((error, _request, response, _next) => response.status(error.statusCode || 500).json({ code: error.code }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}${route}` };
}

test("duas instâncias HTTP compartilham AUTH_STRICT no mesmo Redis", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const route = `/multiprocess-${suffix}`;
  const redisUrl = process.env.REDIS_MULTIPROCESS_URL || "redis://127.0.0.1:6379";
  const redisA = new IORedis(redisUrl, { lazyConnect: true, connectTimeout: 2_000, maxRetriesPerRequest: 1 });
  const redisB = new IORedis(redisUrl, { lazyConnect: true, connectTimeout: 2_000, maxRetriesPerRequest: 1 });
  const apiA = await startApi(redisA, route);
  const apiB = await startApi(redisB, route);
  try {
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await fetch(index % 2 ? apiA.url : apiB.url, { method: "POST" });
      statuses.push(response.status);
      if (index === 10) assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(204));
    assert.equal(statuses[10], 429);
  } finally {
    await Promise.all([
      new Promise((resolve) => apiA.server.close(resolve)),
      new Promise((resolve) => apiB.server.close(resolve)),
    ]);
    await Promise.all([redisA.quit(), redisB.quit()]);
  }
});
