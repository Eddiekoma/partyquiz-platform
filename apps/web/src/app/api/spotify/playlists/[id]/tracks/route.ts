/**
 * Spotify Playlist Tracks API
 * Get all tracks from a specific playlist
 *
 * NOTE (Feb 2026): Spotify deprecated `tracks` field in Get Playlist response.
 * The new field is `items`. Within each PlaylistTrackObject, `track` is also
 * deprecated in favor of `item`. We try the new fields first, then fall back
 * to the legacy names so both old and new API responses work.
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

// Unified track shape from a playlist item (handles both old `track` and new `item`)
interface SpotifyPlaylistTrackItem {
  added_at?: string;
  // New field name
  item?: {
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: {
      id: string;
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
      release_date: string;
    };
    duration_ms: number;
    uri: string;
  } | null;
  // Legacy field name (deprecated)
  track?: {
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: {
      id: string;
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
      release_date: string;
    };
    duration_ms: number;
    uri: string;
  } | null;
}

interface SpotifyPaginatedItems {
  items: SpotifyPlaylistTrackItem[];
  total: number;
  limit: number;
  offset: number;
}

interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string; height: number | null; width: number | null }>;
  owner: { display_name: string };
  // New field (Feb 2026)
  items?: SpotifyPaginatedItems;
  // Legacy field (deprecated)
  tracks?: SpotifyPaginatedItems;
}

/**
 * GET /api/spotify/playlists/[id]/tracks?limit=50&offset=0
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playlistId = (await params).id;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Request both new (`items`) and legacy (`tracks`) field names.
    // Spotify returns whichever is active; the other is simply ignored.
    const fieldsNew =
      "id,name,description,images,owner(display_name)," +
      "items(items(added_at," +
      "item(id,name,artists(id,name),album(id,name,images,release_date),duration_ms,uri)," +
      "track(id,name,artists(id,name),album(id,name,images,release_date),duration_ms,uri)" +
      "),total,limit,offset)," +
      "tracks(items(added_at," +
      "item(id,name,artists(id,name),album(id,name,images,release_date),duration_ms,uri)," +
      "track(id,name,artists(id,name),album(id,name,images,release_date),duration_ms,uri)" +
      "),total,limit,offset)";

    const url =
      `/playlists/${playlistId}` +
      `?market=NL` +
      `&fields=${fieldsNew}` +
      `&limit=${limit}` +
      `&offset=${offset}`;

    const result = await spotifyFetch<SpotifyPlaylistResponse>(url);

    if ("error" in result) return result.error;

    const playlist = result.data;

    // Prefer new `items` field, fall back to legacy `tracks`
    const paginated = playlist.items ?? playlist.tracks;
    const rawItems = paginated?.items ?? [];

    // Each entry may have `item` (new) or `track` (legacy) — take whichever exists
    const tracks = rawItems
      .map((entry) => entry.item ?? entry.track)
      .filter((t): t is NonNullable<typeof t> => t != null && t.id != null)
      .map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: t.album.id,
          name: t.album.name,
          images: t.album.images,
          release_date: t.album.release_date,
        },
        duration_ms: t.duration_ms,
        uri: t.uri,
      }));

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        image: playlist.images?.[0]?.url || null,
        owner: playlist.owner?.display_name ?? "Unknown",
      },
      tracks,
      total: paginated?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Spotify playlist tracks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
