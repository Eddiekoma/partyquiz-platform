/**
 * Spotify Related Artists API
 * /artists/{id}/related-artists is DEPRECATED (returns 403 as of Feb 2026).
 * Replaced with Search API: search for artists with similar names/style.
 * We fetch the artist name first, then search for similar artists.
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/artists/[id]/related
 * Uses Search API as fallback for deprecated endpoint
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
    const offset = parseInt(searchParams.get("offset") || "0");

    // First, get the artist name
    const artistResult = await spotifyFetch<{
      id: string;
      name: string;
      genres?: string[];
    }>(`/artists/${artistId}`);

    if ("error" in artistResult) return artistResult.error;

    const artistName = artistResult.data.name;

    // Search for similar artists using the artist name as a query
    // This returns artists with similar names/relevance
    const searchResult = await spotifyFetch<{
      artists?: {
        items: Array<{
          id: string;
          name: string;
          genres?: string[];
          images?: Array<{ url: string; height: number | null; width: number | null }>;
          popularity?: number;
          followers?: { total: number };
          uri: string;
        }>;
        total: number;
      };
    }>(`/search?q=${encodeURIComponent(artistName)}&type=artist&limit=10&offset=${offset}&market=NL`);

    if ("error" in searchResult) return searchResult.error;

    // Filter out the original artist from results
    const artists = (searchResult.data.artists?.items ?? [])
      .filter((a) => a != null && a.id !== artistId)
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
      total: searchResult.data.artists?.total ?? 0,
      offset,
    });
  } catch (error) {
    console.error("Spotify related artists error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
