import Redis from "ioredis";
import { Queue } from "bullmq";

let queue;
const getQueue = () => {
  if (!process.env.REDIS_URL) return null;
  if (!queue) queue = new Queue("forecast-refresh", {
    connection: new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }),
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 100, removeOnFail: 500 },
  });
  return queue;
};

export const enqueueForecastRefresh = async (productIds) => {
  const q = getQueue();
  if (!q) return { queued: false, message: "Background forecast queue is disabled; configure REDIS_URL." };
  const jobs = await q.addBulk(productIds.map((productId) => ({ name: "refresh-product-forecast", data: { productId } })));
  return { queued: true, jobs: jobs.length, jobIds: jobs.map((job) => job.id) };
};

export const closeForecastQueue = async () => {
  if (!queue) return;
  await queue.disconnect();
  queue = null;
};
