/**
 * Spotify User Saved Tracks API
 * Get user's liked/saved songs (requires user-library-read scope)
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/me/saved-tracks?limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await spotifyFetch<{
      items: Array<{
        added_at: string;
        track: {
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
        };
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/me/tracks?limit=${limit}&offset=${offset}&market=NL`);

    if ("error" in result) return result.error;

    const tracks = result.data.items
      .filter((item) => item?.track != null)
      .map((item) => ({
        id: item.track.id,
        name: item.track.name,
        artists: (item.track.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: item.track.album?.id ?? "",
          name: item.track.album?.name ?? "Unknown Album",
          images: item.track.album?.images ?? [],
          release_date: item.track.album?.release_date ?? "",
        },
        duration_ms: item.track.duration_ms ?? 0,
        uri: item.track.uri,
        addedAt: item.added_at,
      }));

    return NextResponse.json({
      tracks,
      total: result.data.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify saved tracks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
