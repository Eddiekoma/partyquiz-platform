/**
 * Spotify Artist Albums API
 * Get all albums by a specific artist
 * Spotify API limit: Default 5, Range 0-10 (as of Feb 2026)
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/artists/[id]/albums?include_groups=album,single&limit=10&offset=0
 * include_groups: album, single, appears_on, compilation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const artistId = (await params).id;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const includeGroups = searchParams.get("include_groups") || "album,single";
    // Spotify API: Default=5, Range=0-10 (max 10 as of Feb 2026)
    const limitParsed = parseInt(searchParams.get("limit") || "10");
    const limit = Number.isNaN(limitParsed) ? 5 : Math.min(Math.max(limitParsed, 1), 10);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await spotifyFetch<{
      items: Array<{
        id: string;
        name: string;
        album_type?: string;
        total_tracks?: number;
        artists?: Array<{ id: string; name: string }>;
        images?: Array<{ url: string; height: number | null; width: number | null }>;
        release_date?: string;
        uri: string;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/artists/${artistId}/albums?include_groups=${includeGroups}&market=NL&limit=${limit}&offset=${offset}`);

    if ("error" in result) return result.error;

    const albums = result.data.items
      .filter((a) => a != null)
      .map((album) => ({
        id: album.id,
        name: album.name,
        albumType: album.album_type ?? "album",
        totalTracks: album.total_tracks ?? 0,
        artists: (album.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
        images: album.images ?? [],
        releaseDate: album.release_date ?? "",
        uri: album.uri,
      }));

    return NextResponse.json({
      albums,
      total: result.data.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify artist albums error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
