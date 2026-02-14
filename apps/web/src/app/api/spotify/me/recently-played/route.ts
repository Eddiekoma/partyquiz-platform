/**
 * Spotify Recently Played Tracks API
 * Get user's recently played tracks
 * Requires user-read-recently-played scope
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/me/recently-played?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 50);

    const result = await spotifyFetch<{
      items: Array<{
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
        played_at: string;
        context?: {
          type: string;
          uri: string;
        } | null;
      }>;
      total?: number;
      cursors?: {
        after: string;
        before: string;
      };
    }>(`/me/player/recently-played?limit=${limit}`);

    if ("error" in result) return result.error;

    const tracks = result.data.items
      .filter((item) => item?.track != null && item.track.id)
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
        playedAt: item.played_at,
      }));

    return NextResponse.json({
      tracks,
      total: result.data.total ?? tracks.length,
      cursors: result.data.cursors ?? null,
    });
  } catch (error) {
    console.error("Spotify recently played error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
