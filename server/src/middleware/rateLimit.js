import { createHash } from "node:crypto";
import { getRedisClient } from "../config/redis.js";

const buckets = new Map();
let redisWarningLogged = false;

const localCount = (key, windowMs, now) => {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 10000) {
    for (const [ip, entry] of buckets) if (entry.resetAt <= now) buckets.delete(ip);
    while (buckets.size > 10000) buckets.delete(buckets.keys().next().value);
  }
  return { count: bucket.count, resetAt: bucket.resetAt };
};

// Uses Redis for shared limits across instances; keeps a bounded process-local fallback for standalone development.
const rateLimit = ({ name = "default", windowMs, limit, message = "Too many requests. Please try again later." }) => async (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const hashedIp = createHash("sha256").update(ip).digest("hex");
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  let count;
  const redis = getRedisClient();
  if (redis) {
    try {
      const key = `rate:${name}:${hashedIp}:${windowStart}`;
      if (redis.status === "wait") await redis.connect();
      count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs * 2);
    } catch (error) {
      if (!redisWarningLogged) {
        redisWarningLogged = true;
        console.warn("Redis rate limits unavailable; using local fallback", { message: error.message });
      }
    }
  }
  if (count === undefined) count = localCount(`${name}:${hashedIp}`, windowMs, now).count;
  res.set("RateLimit-Limit", String(limit));
  res.set("RateLimit-Remaining", String(Math.max(0, limit - count)));
  res.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  if (count > limit) return res.status(429).json({ message });
  return next();
};

export default rateLimit;
