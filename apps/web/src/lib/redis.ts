import { createClient } from "redis";
import { getEnv } from "./env";

const env = getEnv();

const redis = createClient({
  url: env.REDIS_URL,
});

redis.on("error", (err) => console.error("Redis Client Error", err));

let isConnected = false;

export async function getRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
  return redis;
}

// Session cache helpers
export async function setSessionCache(key: string, value: any, ttl: number = 3600) {
  const client = await getRedis();
  await client.setEx(key, ttl, JSON.stringify(value));
}

export async function getSessionCache<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

export async function deleteSessionCache(key: string) {
  const client = await getRedis();
  await client.del(key);
}

// Rate limiting helper
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: number
): Promise<{ allowed: boolean; remaining: number }> {
  const client = await getRedis();
  const key = `ratelimit:${identifier}`;
  
  const current = await client.incr(key);
  
  if (current === 1) {
    await client.expire(key, window);
  }

  const remaining = Math.max(0, limit - current);
  
  return {
    allowed: current <= limit,
    remaining,
  };
}
