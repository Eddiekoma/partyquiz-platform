/**
 * Spotify Album Tracks API
 * Get all tracks from a specific album
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch } from "@/lib/spotify";

/**
 * GET /api/spotify/albums/[id]/tracks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const albumId = (await params).id;

    const result = await spotifyFetch<any>(`/albums/${albumId}?market=NL`);
    if ("error" in result) return result.error;

    const album = result.data;

    // Map tracks with album info attached (Spotify album tracks don't include album data)
    const tracks = album.tracks.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => ({ id: a.id, name: a.name })),
      album: {
        id: album.id,
        name: album.name,
        images: album.images,
        release_date: album.release_date,
      },
      duration_ms: track.duration_ms,
      track_number: track.track_number,
      uri: track.uri,
    }));

    return NextResponse.json({
      album: {
        id: album.id,
        name: album.name,
        artists: album.artists.map((a: any) => ({ id: a.id, name: a.name })),
        images: album.images,
        release_date: album.release_date,
        total_tracks: album.total_tracks,
      },
      tracks,
    });
  } catch (error) {
    console.error("Spotify album tracks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
