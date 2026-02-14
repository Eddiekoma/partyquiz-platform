/**
 * Spotify User Saved Albums API
 * Get user's saved/liked albums
 * Requires user-library-read scope
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/me/saved-albums?limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await spotifyFetch<{
      items: Array<{
        added_at: string;
        album: {
          id: string;
          name: string;
          album_type?: string;
          total_tracks?: number;
          artists?: Array<{ id: string; name: string }>;
          images?: Array<{ url: string; height: number | null; width: number | null }>;
          release_date?: string;
          uri: string;
        };
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/me/albums?limit=${limit}&offset=${offset}&market=NL`);

    if ("error" in result) return result.error;

    const albums = result.data.items
      .filter((item) => item?.album != null)
      .map((item) => ({
        id: item.album.id,
        name: item.album.name,
        albumType: item.album.album_type ?? "album",
        totalTracks: item.album.total_tracks ?? 0,
        artists: (item.album.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
        images: item.album.images ?? [],
        releaseDate: item.album.release_date ?? "",
        uri: item.album.uri,
        addedAt: item.added_at,
      }));

    return NextResponse.json({
      albums,
      total: result.data.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify saved albums error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
