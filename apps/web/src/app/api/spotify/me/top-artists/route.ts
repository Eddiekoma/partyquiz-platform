/**
 * Spotify User Top Artists API
 * Get user's most-listened artists with genres, images, popularity
 * Requires user-top-read scope
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: Array<{ url: string; height: number | null; width: number | null }>;
  popularity?: number;
  followers?: { total: number };
  uri: string;
  type: string;
}

/**
 * GET /api/spotify/me/top-artists?time_range=medium_term&limit=20&offset=0
 * time_range: short_term (4 weeks), medium_term (6 months), long_term (all time)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("time_range") || "medium_term";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!["short_term", "medium_term", "long_term"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid time_range. Use: short_term, medium_term, or long_term" },
        { status: 400 }
      );
    }

    const result = await spotifyFetch<{
      items: SpotifyArtist[];
      total: number;
      limit: number;
      offset: number;
    }>(`/me/top/artists?time_range=${timeRange}&limit=${limit}&offset=${offset}`);

    if ("error" in result) return result.error;

    const artists = result.data.items
      .filter((a) => a != null)
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres ?? [],
        images: artist.images ?? [],
        popularity: artist.popularity ?? 0,
        followers: artist.followers?.total ?? 0,
        uri: artist.uri,
      }));

    return NextResponse.json({
      artists,
      total: result.data.total,
      limit,
      offset,
      timeRange,
    });
  } catch (error) {
    console.error("Spotify top artists error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
