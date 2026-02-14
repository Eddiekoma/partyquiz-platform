/**
 * Spotify API helpers for Next.js API routes
 * Centralizes token management and Spotify API calls
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@partyquiz/shared";
import { NextResponse } from "next/server";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;

/**
 * Get a valid Spotify access token for the current user.
 * Automatically refreshes expired tokens.
 * @returns { accessToken, userId } or null if not connected
 */
export async function getSpotifyToken(): Promise<{
  accessToken: string;
  userId: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyTokenExpiry: true,
    },
  });

  if (!user?.spotifyAccessToken) return null;

  let accessToken = user.spotifyAccessToken;

  // Refresh if expired or within 60s of expiring
  if (
    user.spotifyTokenExpiry &&
    new Date(Date.now() + 60000) >= user.spotifyTokenExpiry
  ) {
    if (!user.spotifyRefreshToken) return null;

    try {
      const tokenResponse = await refreshAccessToken({
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken: user.spotifyRefreshToken,
      });

      accessToken = tokenResponse.access_token;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          spotifyAccessToken: accessToken,
          spotifyTokenExpiry: new Date(
            Date.now() + tokenResponse.expires_in * 1000
          ),
          ...(tokenResponse.refresh_token && {
            spotifyRefreshToken: tokenResponse.refresh_token,
          }),
        },
      });
    } catch {
      return null;
    }
  }

  return { accessToken, userId: session.user.id };
}

/**
 * Make an authenticated request to the Spotify API.
 * Handles auth checks and token refresh automatically.
 * @returns The parsed JSON response from Spotify, or a NextResponse error
 */
export async function spotifyFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T } | { error: NextResponse }> {
  const tokenResult = await getSpotifyToken();

  if (!tokenResult) {
    return {
      error: NextResponse.json(
        { error: "Spotify not connected or token expired" },
        { status: 403 }
      ),
    };
  }

  const url = endpoint.startsWith("https://")
    ? endpoint
    : `https://api.spotify.com/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error(`Spotify API error [${response.status}]:`, errorBody);
    return {
      error: NextResponse.json(
        { error: "Spotify API error", details: errorBody },
        { status: response.status }
      ),
    };
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return { data: {} as T };
  }

  const data = (await response.json()) as T;
  return { data };
}

/**
 * Guard: returns 401 if no session, or the userId
 */
export async function requireAuth(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId: session.user.id };
}
