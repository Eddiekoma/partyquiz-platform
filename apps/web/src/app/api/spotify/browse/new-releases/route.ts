/**
 * Spotify Browse – New Releases API
 * Get a list of new album releases featured in Spotify
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/browse/new-releases?limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await spotifyFetch<{
      albums: {
        items: Array<{
          id: string;
          name: string;
          artists?: Array<{ id: string; name: string }>;
          images?: Array<{ url: string; height: number; width: number }>;
          release_date?: string;
          release_date_precision?: string;
          total_tracks?: number;
          album_type?: string;
          uri: string;
        }>;
        total: number;
        limit: number;
        offset: number;
      };
    }>(`/browse/new-releases?limit=${limit}&offset=${offset}&country=NL`);

    if ("error" in result) return result.error;

    const albums = (result.data.albums?.items ?? [])
      .filter((album) => album != null && album.id)
      .map((album) => ({
        id: album.id,
        name: album.name,
        artists: (album.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
        images: album.images ?? [],
        release_date: album.release_date ?? "",
        release_date_precision: album.release_date_precision ?? "day",
        total_tracks: album.total_tracks ?? 0,
        album_type: album.album_type ?? "album",
        uri: album.uri,
      }));

    return NextResponse.json({
      albums,
      total: result.data.albums?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify new releases error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
