import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.instance.on("connect", () => {
        console.log("[Redis] Connected to Redis server");
      });

      this.instance.on("error", (err) => {
        console.error("[Redis] Connection error:", err);
      });

      this.instance.on("ready", () => {
        console.log("[Redis] Redis client is ready");
      });

      this.instance.on("close", () => {
        console.log("[Redis] Connection closed");
      });
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }
}

export const redis = RedisClient.getInstance();

// Helper functions for common patterns

/**
 * Cache session state (active sessions, player counts)
 */
export async function cacheSessionState(
  sessionCode: string,
  data: any,
  ttlSeconds: number = 3600 // 1 hour default
): Promise<void> {
  const key = `session:${sessionCode}:state`;
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

export async function getSessionState(sessionCode: string): Promise<any | null> {
  const key = `session:${sessionCode}:state`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function deleteSessionState(sessionCode: string): Promise<void> {
  const key = `session:${sessionCode}:state`;
  await redis.del(key);
}

/**
 * Cache leaderboard (sorted set for efficient ranking)
 */
export async function updateLeaderboard(
  sessionCode: string,
  playerId: string,
  score: number
): Promise<void> {
  const key = `session:${sessionCode}:leaderboard`;
  await redis.zadd(key, score, playerId);
  await redis.expire(key, 7200); // 2 hours TTL
}

export async function getLeaderboard(
  sessionCode: string,
  limit: number = 10
): Promise<Array<{ playerId: string; score: number }>> {
  const key = `session:${sessionCode}:leaderboard`;
  const results = await redis.zrevrange(key, 0, limit - 1, "WITHSCORES");

  const leaderboard: Array<{ playerId: string; score: number }> = [];
  for (let i = 0; i < results.length; i += 2) {
    leaderboard.push({
      playerId: results[i],
      score: parseInt(results[i + 1], 10),
    });
  }

  return leaderboard;
}

export async function getPlayerRank(
  sessionCode: string,
  playerId: string
): Promise<number | null> {
  const key = `session:${sessionCode}:leaderboard`;
  const rank = await redis.zrevrank(key, playerId);
  return rank !== null ? rank + 1 : null; // Convert to 1-indexed
}

export async function clearLeaderboard(sessionCode: string): Promise<void> {
  const key = `session:${sessionCode}:leaderboard`;
  await redis.del(key);
}

/**
 * Rate limiting (prevent spam)
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  const allowed = current <= maxRequests;
  const remaining = Math.max(0, maxRequests - current);

  return { allowed, remaining };
}

/**
 * Cache player data (avoid DB queries)
 */
export async function cachePlayer(
  sessionCode: string,
  playerId: string,
  playerData: any,
  ttlSeconds: number = 3600
): Promise<void> {
  const key = `session:${sessionCode}:player:${playerId}`;
  await redis.setex(key, ttlSeconds, JSON.stringify(playerData));
}

export async function getPlayer(
  sessionCode: string,
  playerId: string
): Promise<any | null> {
  const key = `session:${sessionCode}:player:${playerId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function deletePlayer(
  sessionCode: string,
  playerId: string
): Promise<void> {
  const key = `session:${sessionCode}:player:${playerId}`;
  await redis.del(key);
}

/**
 * Cache active players list (set for fast lookups)
 */
export async function addActivePlayer(
  sessionCode: string,
  playerId: string
): Promise<void> {
  const key = `session:${sessionCode}:players`;
  await redis.sadd(key, playerId);
  await redis.expire(key, 7200); // 2 hours
}

export async function removeActivePlayer(
  sessionCode: string,
  playerId: string
): Promise<void> {
  const key = `session:${sessionCode}:players`;
  await redis.srem(key, playerId);
}

export async function getActivePlayers(sessionCode: string): Promise<string[]> {
  const key = `session:${sessionCode}:players`;
  return await redis.smembers(key);
}

export async function getActivePlayerCount(sessionCode: string): Promise<number> {
  const key = `session:${sessionCode}:players`;
  return await redis.scard(key);
}

/**
 * Cache quiz items (reduce DB queries during active session)
 */
export async function cacheQuizItems(
  sessionCode: string,
  items: any[],
  ttlSeconds: number = 3600
): Promise<void> {
  const key = `session:${sessionCode}:items`;
  await redis.setex(key, ttlSeconds, JSON.stringify(items));
}

export async function getQuizItems(sessionCode: string): Promise<any[] | null> {
  const key = `session:${sessionCode}:items`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Lock mechanism (prevent race conditions)
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number = 10
): Promise<boolean> {
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, "1", "EX", ttlSeconds, "NX");
  return acquired === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  const lockKey = `lock:${key}`;
  await redis.del(lockKey);
}

/**
 * Pub/Sub for real-time events (alternative to WebSocket for some cases)
 */
export function createSubscriber(): Redis {
  return new Redis(REDIS_URL);
}

export async function publish(channel: string, message: any): Promise<void> {
  await redis.publish(channel, JSON.stringify(message));
}
