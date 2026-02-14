/**
 * Spotify Token Management for WS Server
 * 
 * The WS server needs Spotify access tokens to make Player API calls
 * (play, pause, seek, transfer, get devices) on behalf of the host user.
 * 
 * Tokens are stored per session in Redis, provided by the host client
 * when they connect/authenticate.
 */

import { prisma } from "./prisma";
import { refreshAccessToken } from "@partyquiz/shared";
import { redis } from "@partyquiz/shared/server";
import { pino } from "pino";

const logger = pino({ name: "spotify-token" });
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";

/**
 * Get a valid Spotify access token for a session's host user.
 * Automatically refreshes expired tokens.
 * 
 * Flow:
 * 1. Check Redis cache first (fast path)
 * 2. If expired, refresh via Spotify API
 * 3. Update both Redis and DB
 */
export async function getSpotifyTokenForSession(
  sessionCode: string
): Promise<string | null> {
  try {
    // Try Redis cache first
    const cachedToken = await redis.get(`session:${sessionCode}:spotifyToken`);
    const cachedExpiry = await redis.get(`session:${sessionCode}:spotifyTokenExpiry`);
    
    if (cachedToken && cachedExpiry) {
      const expiryMs = parseInt(cachedExpiry);
      // Return cached if still valid (with 60s buffer)
      if (Date.now() + 60000 < expiryMs) {
        return cachedToken;
      }
    }

    // Get host user ID for this session
    const hostUserId = await redis.get(`session:${sessionCode}:hostUserId`);
    if (!hostUserId) {
      logger.warn({ sessionCode }, "No host user ID found for session");
      return null;
    }

    // Load from DB
    const user = await prisma.user.findUnique({
      where: { id: hostUserId },
      select: {
        spotifyAccessToken: true,
        spotifyRefreshToken: true,
        spotifyTokenExpiry: true,
      },
    });

    if (!user?.spotifyAccessToken) {
      logger.warn({ sessionCode, hostUserId }, "Host user has no Spotify token");
      return null;
    }

    let accessToken = user.spotifyAccessToken;

    // Check if token needs refresh (expired or within 60s of expiring)
    if (
      user.spotifyTokenExpiry &&
      new Date(Date.now() + 60000) >= user.spotifyTokenExpiry
    ) {
      if (!user.spotifyRefreshToken) {
        logger.warn({ sessionCode }, "No refresh token available");
        return null;
      }

      try {
        logger.info({ sessionCode }, "Refreshing Spotify token");
        const tokenResponse = await refreshAccessToken({
          clientId: SPOTIFY_CLIENT_ID,
          refreshToken: user.spotifyRefreshToken,
        });

        accessToken = tokenResponse.access_token;
        const newExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);

        // Update DB
        await prisma.user.update({
          where: { id: hostUserId },
          data: {
            spotifyAccessToken: accessToken,
            spotifyTokenExpiry: newExpiry,
            ...(tokenResponse.refresh_token && {
              spotifyRefreshToken: tokenResponse.refresh_token,
            }),
          },
        });

        // Cache in Redis (TTL = token lifetime - 2 minutes buffer)
        const ttl = Math.max(60, tokenResponse.expires_in - 120);
        await redis.set(`session:${sessionCode}:spotifyToken`, accessToken, "EX", ttl);
        await redis.set(`session:${sessionCode}:spotifyTokenExpiry`, newExpiry.getTime().toString(), "EX", ttl);

        logger.info({ sessionCode }, "Spotify token refreshed successfully");
      } catch (err) {
        logger.error({ err, sessionCode }, "Failed to refresh Spotify token");
        return null;
      }
    } else {
      // Token is still valid - cache it
      const ttl = user.spotifyTokenExpiry
        ? Math.max(60, Math.floor((user.spotifyTokenExpiry.getTime() - Date.now()) / 1000) - 120)
        : 3000; // 50 min default
      await redis.set(`session:${sessionCode}:spotifyToken`, accessToken, "EX", ttl);
      if (user.spotifyTokenExpiry) {
        await redis.set(`session:${sessionCode}:spotifyTokenExpiry`, user.spotifyTokenExpiry.getTime().toString(), "EX", ttl);
      }
    }

    return accessToken;
  } catch (err) {
    logger.error({ err, sessionCode }, "Error getting Spotify token for session");
    return null;
  }
}

/**
 * Store the host user ID for a session (called when host joins)
 * This links the session to the host's Spotify credentials
 */
export async function setSessionHostUser(
  sessionCode: string,
  userId: string
): Promise<void> {
  await redis.set(`session:${sessionCode}:hostUserId`, userId, "EX", 86400); // 24h TTL
}

/**
 * Clear Spotify token cache for a session
 */
export async function clearSessionSpotifyToken(sessionCode: string): Promise<void> {
  await redis.del(`session:${sessionCode}:spotifyToken`);
  await redis.del(`session:${sessionCode}:spotifyTokenExpiry`);
  await redis.del(`session:${sessionCode}:hostUserId`);
}
