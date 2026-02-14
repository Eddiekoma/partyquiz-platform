/**
 * Spotify Artist Top Tracks API
 * /artists/{id}/top-tracks is DEPRECATED (returns 403 as of Feb 2026).
 * Replaced with Search API: search for tracks by artist name.
 * We first fetch the artist name via /artists/{id} (still works),
 * then search for tracks with artist:"Name".
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/artists/[id]/top-tracks
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

    // First, get the artist name (the /artists/{id} endpoint still works)
    const artistResult = await spotifyFetch<{
      id: string;
      name: string;
      genres?: string[];
      images?: Array<{ url: string; height: number | null; width: number | null }>;
    }>(`/artists/${artistId}`);

    if ("error" in artistResult) return artistResult.error;

    const artistName = artistResult.data.name;

    // Search for tracks by this artist (max 10 per request)
    const searchResult = await spotifyFetch<{
      tracks?: {
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
          popularity?: number;
          uri: string;
        }>;
        total: number;
      };
    }>(`/search?q=${encodeURIComponent(`artist:"${artistName}"`)}&type=track&limit=10&offset=${offset}&market=NL`);

    if ("error" in searchResult) return searchResult.error;

    const items = searchResult.data.tracks?.items ?? [];

    // Filter to only tracks where this artist is actually listed
    const tracks = items
      .filter((track) => {
        if (!track?.id) return false;
        // Check if the target artist is in the track's artists list
        return (track.artists ?? []).some(
          (a) => a.id === artistId || a.name.toLowerCase() === artistName.toLowerCase()
        );
      })
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
        popularity: track.popularity ?? 0,
        uri: track.uri,
      }));

    return NextResponse.json({
      tracks,
      total: searchResult.data.tracks?.total ?? 0,
      offset,
    });
  } catch (error) {
    console.error("Spotify artist top tracks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
