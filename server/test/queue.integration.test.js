import test from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { createForecastWorker } from "../src/jobs/forecastWorker.js";
import { closeForecastQueue, enqueueForecastRefresh } from "../src/jobs/forecastQueue.js";

test("BullMQ forecast job is processed and cached when Redis is available", {
  skip: !process.env.REDIS_URL && "Set REDIS_URL to a disposable Redis instance",
}, async (t) => {
  const productId = `queue-test-${Date.now()}`;
  const { worker, connection, cacheConnection } = createForecastWorker({
    calculateForecast: async ({ productId: id, horizonDays }) => ({ productId: id, horizonDays, totalUnits: 8 }),
  });
  const cacheReader = new Redis(process.env.REDIS_URL);
  t.after(async () => {
    await worker.close(true);
    connection.disconnect();
    cacheConnection.disconnect();
    cacheReader.disconnect();
    await closeForecastQueue();
  });

  await worker.waitUntilReady();
  const queued = await enqueueForecastRefresh([productId]);
  assert.equal(queued.queued, true);
  assert.equal(queued.jobs, 1);
  let completedResult;
  let cached;
  const deadline = Date.now() + 10000;
  while ((!completedResult || !cached) && Date.now() < deadline) {
    const entries = await cacheReader.xrange("bull:forecast-refresh:events", "-", "+");
    for (const [, fields] of entries) {
      const event = Object.fromEntries(Array.from({ length: fields.length / 2 }, (_, index) => [fields[index * 2], fields[index * 2 + 1]]));
      if (event.event === "completed" && event.returnvalue) {
        const result = JSON.parse(event.returnvalue);
        if (result.productId === productId) completedResult = result;
      }
    }
    cached = await cacheReader.get(`forecast:${productId}`);
    if (!completedResult || !cached) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.deepEqual(completedResult, { productId, available: true });
  assert.ok(cached, "forecast worker should complete the queued job");
  assert.deepEqual(JSON.parse(cached), { productId, horizonDays: 7, totalUnits: 8 });
});
