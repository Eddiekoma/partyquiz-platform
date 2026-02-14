/**
 * Spotify Playback Control API
 * Start/pause/resume playback on a specific device via Spotify Connect
 */

import { NextRequest, NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify";

/**
 * POST /api/spotify/play
 * Body: { trackId, deviceId?, action: "play" | "pause" | "resume", positionMs? }
 */
export async function POST(request: NextRequest) {
  try {
    const tokenResult = await getSpotifyToken();
    if (!tokenResult) {
      return NextResponse.json(
        { error: "Spotify not connected or token expired" },
        { status: 403 }
      );
    }

    const { accessToken } = tokenResult;
    const body = await request.json();
    const { trackId, deviceId, action = "play", positionMs = 0 } = body;

    if (action === "pause") {
      const url = new URL("https://api.spotify.com/v1/me/player/pause");
      if (deviceId) url.searchParams.set("device_id", deviceId);

      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok && res.status !== 403) {
        const error = await res.text();
        console.error("Spotify pause error:", error);
        return NextResponse.json({ error: "Failed to pause" }, { status: res.status });
      }

      return NextResponse.json({ success: true, action: "paused" });
    }

    if (action === "resume") {
      const url = new URL("https://api.spotify.com/v1/me/player/play");
      if (deviceId) url.searchParams.set("device_id", deviceId);

      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Spotify resume error:", error);
        return NextResponse.json({ error: "Failed to resume" }, { status: res.status });
      }

      return NextResponse.json({ success: true, action: "resumed" });
    }

    // Play a specific track
    if (!trackId) {
      return NextResponse.json({ error: "trackId is required" }, { status: 400 });
    }

    const url = new URL("https://api.spotify.com/v1/me/player/play");
    if (deviceId) url.searchParams.set("device_id", deviceId);

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
        position_ms: positionMs,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Spotify play error:", error);

      if (res.status === 403) {
        return NextResponse.json(
          { error: "Spotify Premium is required for playback", premium: false },
          { status: 403 }
        );
      }

      if (res.status === 404) {
        return NextResponse.json(
          { error: "No active Spotify device found. Open Spotify first.", noDevice: true },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: "Failed to start playback" }, { status: res.status });
    }

    return NextResponse.json({ success: true, action: "playing", trackId });
  } catch (error) {
    console.error("Spotify play error:", error);
    return NextResponse.json(
      { error: "Failed to control playback" },
      { status: 500 }
    );
  }
}
