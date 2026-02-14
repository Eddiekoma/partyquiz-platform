/**
 * Spotify Playlists API
 * Get current user's playlists
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string; height: number | null; width: number | null }>;
  items?: { href: string; total: number };
  tracks?: { href: string; total: number };
  owner?: { display_name: string; id: string };
  public: boolean;
  collaborative: boolean;
}

/**
 * GET /api/spotify/playlists?limit=20&offset=0
 * Returns current user's playlists
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await spotifyFetch<{
      items: SpotifyPlaylist[];
      total: number;
      limit: number;
      offset: number;
    }>(`/me/playlists?limit=${limit}&offset=${offset}`);

    if ("error" in result) return result.error;

    const playlists = result.data.items
      .filter((p) => p != null)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        image: p.images?.[0]?.url || null,
        trackCount: p.items?.total ?? p.tracks?.total ?? 0,
        owner: p.owner?.display_name ?? "Unknown",
        isPublic: p.public,
        isCollaborative: p.collaborative,
      }));

    return NextResponse.json({
      playlists,
      total: result.data.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify playlists error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
