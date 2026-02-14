/**
 * Spotify User Top Tracks API
 * Get user's most-played tracks (requires user-top-read scope)
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/me/top-tracks?time_range=medium_term&limit=20&offset=0
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

    // Validate time_range
    if (!["short_term", "medium_term", "long_term"].includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid time_range. Use: short_term, medium_term, or long_term" },
        { status: 400 }
      );
    }

    const result = await spotifyFetch<{
      items: Array<{
        id: string;
        name: string;
        artists?: Array<{ id: string; name: string }>;
        album?: {
          id: string;
          name: string;
          images: Array<{ url: string; height: number; width: number }>;
          release_date: string;
        };
        duration_ms?: number;
        uri: string;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/me/top/tracks?time_range=${timeRange}&limit=${limit}&offset=${offset}`);

    if ("error" in result) return result.error;

    const tracks = result.data.items
      .filter((track) => track != null)
      .map((track) => ({
        id: track.id,
        name: track.name,
        artists: (track.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: track.album?.id ?? "",
          name: track.album?.name ?? "Unknown Album",
          images: track.album?.images ?? [],
          release_date: track.album?.release_date ?? "",
        },
        duration_ms: track.duration_ms ?? 0,
        uri: track.uri,
      }));

    return NextResponse.json({
      tracks,
      total: result.data.total,
      limit,
      offset,
      timeRange,
    });
  } catch (error) {
    console.error("Spotify top tracks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
