/**
 * Spotify Artist Details API
 * Get detailed info about a specific artist: genres, followers, images, popularity
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/artists/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const artistId = (await params).id;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const result = await spotifyFetch<{
      id: string;
      name: string;
      genres?: string[];
      images?: Array<{ url: string; height: number | null; width: number | null }>;
      popularity?: number;
      followers?: { total: number };
      uri: string;
      type: string;
    }>(`/artists/${artistId}`);

    if ("error" in result) return result.error;

    const artist = result.data;

    return NextResponse.json({
      id: artist.id,
      name: artist.name,
      genres: artist.genres ?? [],
      images: artist.images ?? [],
      popularity: artist.popularity ?? 0,
      followers: artist.followers?.total ?? 0,
      uri: artist.uri,
    });
  } catch (error) {
    console.error("Spotify artist details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
