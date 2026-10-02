import Redis from "ioredis";

let client;
export const getRedisClient = () => {
  if (!process.env.REDIS_URL) return null;
  if (!client) client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  return client;
};

export const closeRedisClient = async () => {
  if (!client) return;
  await client.quit();
  client = null;
};
