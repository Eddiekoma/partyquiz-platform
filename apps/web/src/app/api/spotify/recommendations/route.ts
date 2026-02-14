/**
 * Spotify Recommendations API
 * Get track recommendations based on seed artists, tracks, and/or genres
 * Up to 5 seeds total (any combination of artists + tracks + genres)
 */

import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch, requireAuth } from "@/lib/spotify";

/**
 * GET /api/spotify/recommendations?seed_artists=id1,id2&seed_tracks=id3&seed_genres=pop,rock&limit=20
 * 
 * Optional tunable attributes:
 * - min_energy, max_energy, target_energy (0-1)
 * - min_danceability, max_danceability, target_danceability (0-1)
 * - min_tempo, max_tempo, target_tempo (BPM)
 * - min_popularity, max_popularity, target_popularity (0-100)
 * - min_valence, max_valence, target_valence (0-1) = musical positiveness
 * - min_acousticness, max_acousticness, target_acousticness (0-1)
 * - min_instrumentalness, max_instrumentalness, target_instrumentalness (0-1)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const seedArtists = searchParams.get("seed_artists") || "";
    const seedTracks = searchParams.get("seed_tracks") || "";
    const seedGenres = searchParams.get("seed_genres") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Validate at least one seed is provided
    if (!seedArtists && !seedTracks && !seedGenres) {
      return NextResponse.json(
        { error: "At least one seed (seed_artists, seed_tracks, or seed_genres) is required" },
        { status: 400 }
      );
    }

    // Build query params
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("market", "NL");
    if (seedArtists) params.set("seed_artists", seedArtists);
    if (seedTracks) params.set("seed_tracks", seedTracks);
    if (seedGenres) params.set("seed_genres", seedGenres);

    // Forward tunable attributes
    const tunableAttributes = [
      "min_energy", "max_energy", "target_energy",
      "min_danceability", "max_danceability", "target_danceability",
      "min_tempo", "max_tempo", "target_tempo",
      "min_popularity", "max_popularity", "target_popularity",
      "min_valence", "max_valence", "target_valence",
      "min_acousticness", "max_acousticness", "target_acousticness",
      "min_instrumentalness", "max_instrumentalness", "target_instrumentalness",
      "min_speechiness", "max_speechiness", "target_speechiness",
      "min_liveness", "max_liveness", "target_liveness",
      "min_loudness", "max_loudness", "target_loudness",
    ];
    for (const attr of tunableAttributes) {
      const val = searchParams.get(attr);
      if (val) params.set(attr, val);
    }

    const result = await spotifyFetch<{
      tracks: Array<{
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
      seeds: Array<{
        id: string;
        type: string;
        initialPoolSize: number;
        afterFilteringSize: number;
        afterRelinkingSize: number;
      }>;
    }>(`/recommendations?${params.toString()}`);

    if ("error" in result) return result.error;

    const tracks = (result.data.tracks ?? [])
      .filter((track) => track != null && track.id)
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
      seeds: result.data.seeds ?? [],
    });
  } catch (error) {
    console.error("Spotify recommendations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
