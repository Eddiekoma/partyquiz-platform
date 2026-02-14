/**
 * Spotify Track Details API
 * Get detailed information about a specific track by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch } from "@/lib/spotify";

/**
 * GET /api/spotify/track/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const trackId = (await params).id;

    const result = await spotifyFetch<any>(`/tracks/${trackId}?market=NL`);
    if ("error" in result) return result.error;

    const track = result.data;

    return NextResponse.json({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images,
        release_date: track.album.release_date,
      },
      duration_ms: track.duration_ms,
      uri: track.uri,
      external_urls: track.external_urls,
      // Extract year for MUSIC_GUESS_YEAR questions
      releaseYear: parseInt(track.album.release_date.substring(0, 4)),
    });
  } catch (error) {
    console.error("Spotify track error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
