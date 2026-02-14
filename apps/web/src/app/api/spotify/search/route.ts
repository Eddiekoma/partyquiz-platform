/**
 * Spotify Search API - Search for tracks, artists, albums, playlists
 * Requires authenticated user with valid Spotify token
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/search?q=query&type=track,album,playlist&limit=20
 * type can be comma-separated: track, artist, album, playlist
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const type = searchParams.get("type") || "track,album"; // Default: tracks + albums
    // Spotify Search API: Default: 5, Range: 0-10 (as of 2026)
    const limitParsed = parseInt(searchParams.get("limit") || "5");
    const limit = Number.isNaN(limitParsed) ? 5 : Math.min(Math.max(limitParsed, 1), 10);
    const offsetParsed = parseInt(searchParams.get("offset") || "0");
    const offset = Number.isNaN(offsetParsed) ? 0 : Math.max(offsetParsed, 0);

    if (!query) {
      return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
    }

    // Validate types
    const validTypes = ["track", "artist", "album", "playlist"];
    const requestedTypes = type.split(",").map((t) => t.trim());
    const invalidTypes = requestedTypes.filter((t) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Invalid type(s): ${invalidTypes.join(", ")}. Valid: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const spotifyUrl = `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&offset=${offset}&market=NL`;

    const result = await spotifyFetch<Record<string, any>>(spotifyUrl);

    if ("error" in result) return result.error;

    const data = result.data;

    // Return results (formatted for frontend)
    return NextResponse.json({
      tracks: data.tracks?.items || [],
      artists: data.artists?.items || [],
      albums: data.albums?.items || [],
      playlists: data.playlists?.items || [],
      total: {
        tracks: data.tracks?.total || 0,
        artists: data.artists?.total || 0,
        albums: data.albums?.total || 0,
        playlists: data.playlists?.total || 0,
      },
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
