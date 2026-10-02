import { Worker } from "bullmq";
import Redis from "ioredis";
import { getForecast } from "../services/intelligence.js";

export const createForecastWorker = ({ redisUrl = process.env.REDIS_URL, calculateForecast = getForecast } = {}) => {
  if (!redisUrl) throw new Error("REDIS_URL is required to run the forecast worker");
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const cacheConnection = new Redis(redisUrl);
  const worker = new Worker("forecast-refresh", async (job) => {
    const forecast = await calculateForecast({ productId: job.data.productId, horizonDays: 7 });
    if (forecast) await cacheConnection.set(`forecast:${job.data.productId}`, JSON.stringify(forecast), "EX", 3600);
    return { productId: job.data.productId, available: Boolean(forecast) };
  }, { connection });
  return { worker, connection, cacheConnection };
};
