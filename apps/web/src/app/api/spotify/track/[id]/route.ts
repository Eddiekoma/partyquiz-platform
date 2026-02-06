/**
 * Spotify Track Details API
 * Get detailed information about a specific track by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@partyquiz/shared";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;

/**
 * GET /api/spotify/track/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const trackId = (await params).id;

    // Authenticate user
    const session = await auth();
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
        { error: "Spotify not connected" },
        { status: 403 }
      );
    }

    // Check and refresh token if needed
    let accessToken = user.spotifyAccessToken;
    if (user.spotifyTokenExpiry && new Date() >= user.spotifyTokenExpiry) {
      if (!user.spotifyRefreshToken) {
        return NextResponse.json(
          { error: "Spotify token expired" },
          { status: 403 }
        );
      }

      const tokenResponse = await refreshAccessToken({
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken: user.spotifyRefreshToken,
      });

      accessToken = tokenResponse.access_token;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          spotifyAccessToken: accessToken,
          spotifyTokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000),
        },
      });
    }

    // Fetch track details from Spotify
    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}?market=NL`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: "Failed to fetch track", details: error },
        { status: response.status }
      );
    }

    const track = await response.json();

    // Return formatted track data
    return NextResponse.json({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images,
        release_date: track.album.release_date,
      },
      preview_url: track.preview_url,
      duration_ms: track.duration_ms,
      uri: track.uri,
      external_urls: track.external_urls,
      // Extract year for MUSIC_GUESS_YEAR questions
      releaseYear: parseInt(track.album.release_date.substring(0, 4)),
    });
  } catch (error) {
    console.error("Spotify track error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
