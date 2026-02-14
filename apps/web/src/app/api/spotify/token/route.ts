/**
 * Spotify Token API - Returns access token for client-side Web Playback SDK
 * The SDK needs a valid access token to initialize the player
 */

import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify";

/**
 * GET /api/spotify/token
 * Returns the current access token (refreshing if expired)
 * Used by the Web Playback SDK on the client side
 */
export async function GET() {
  try {
    const tokenResult = await getSpotifyToken();

    if (!tokenResult) {
      return NextResponse.json(
        { error: "Spotify not connected or token expired" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      accessToken: tokenResult.accessToken,
    });
  } catch (error) {
    console.error("Spotify token error:", error);
    return NextResponse.json(
      { error: "Failed to get Spotify token" },
      { status: 500 }
    );
  }
}
