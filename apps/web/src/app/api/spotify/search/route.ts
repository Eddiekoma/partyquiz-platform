/**
 * Spotify Search API - Search for tracks, artists, albums
 * Requires authenticated user with valid Spotify token
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken, type SpotifyTrack } from "@partyquiz/shared";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;

/**
 * GET /api/spotify/search?q=query&type=track&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's Spotify tokens
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        spotifyAccessToken: true,
        spotifyRefreshToken: true,
        spotifyTokenExpiry: true,
      },
    });

    if (!user?.spotifyAccessToken) {
      return NextResponse.json(
        { error: "Spotify not connected. Please authenticate first." },
        { status: 403 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.spotifyAccessToken;
    if (user.spotifyTokenExpiry && new Date() >= user.spotifyTokenExpiry) {
      if (!user.spotifyRefreshToken) {
        return NextResponse.json(
          { error: "Spotify token expired. Please reconnect." },
          { status: 403 }
        );
      }

      // Refresh token
      const tokenResponse = await refreshAccessToken({
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken: user.spotifyRefreshToken,
      });

      accessToken = tokenResponse.access_token;

      // Update stored tokens
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          spotifyAccessToken: accessToken,
          spotifyTokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000),
          // Spotify may return new refresh token on refresh
          ...(tokenResponse.refresh_token && {
            spotifyRefreshToken: tokenResponse.refresh_token,
          }),
        },
      });
    }

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const type = searchParams.get("type") || "track"; // track, artist, album
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query) {
      return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
    }

    // Call Spotify Web API
    const spotifyUrl = new URL("https://api.spotify.com/v1/search");
    spotifyUrl.searchParams.set("q", query);
    spotifyUrl.searchParams.set("type", type);
    spotifyUrl.searchParams.set("limit", limit.toString());
    spotifyUrl.searchParams.set("offset", offset.toString());
    spotifyUrl.searchParams.set("market", "NL"); // Limit to Dutch market

    const response = await fetch(spotifyUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Spotify API error:", error);
      return NextResponse.json(
        { error: "Spotify API error", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return results (formatted for frontend)
    return NextResponse.json({
      tracks: data.tracks?.items || [],
      artists: data.artists?.items || [],
      albums: data.albums?.items || [],
      total: data.tracks?.total || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
