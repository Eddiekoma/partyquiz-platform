/**
 * Spotify OAuth PKCE - Authorization flow start
 * Generates PKCE challenge and redirects to Spotify
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildSpotifyAuthUrl,
} from "@partyquiz/shared";
import crypto from "crypto";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 
  (process.env.APP_BASE_URL || "http://127.0.0.1:3000") + "/api/spotify/callback";

// Required Spotify scopes for our features
const SPOTIFY_SCOPES = [
  "user-read-email",            // Get user email
  "user-read-private",          // Get user profile & subscription type
  "user-library-read",          // Access saved tracks/albums
  "streaming",                  // Web Playback SDK - play full tracks in browser (Premium required)
  "user-modify-playback-state", // Start/pause/skip playback via API
  "user-read-playback-state",   // Read current playback state & devices
  "user-read-currently-playing",// Read currently playing track & queue
  "playlist-read-private",      // Access user's private playlists (for track browsing)
  "playlist-read-collaborative",// Access collaborative playlists
  "user-top-read",              // Access user's top artists and tracks
  "user-read-recently-played",  // Access recently played tracks
  "user-follow-read",           // Access followed artists
];

export async function GET(request: NextRequest) {
  try {
    // Validate environment
    if (!SPOTIFY_CLIENT_ID) {
      return NextResponse.json(
        { error: "Spotify Client ID not configured" },
        { status: 500 }
      );
    }

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString("hex");

    // Store verifier and state in encrypted cookie (expires in 10 minutes)
    const spotifyAuthData = JSON.stringify({ codeVerifier, state });
    
    const response = NextResponse.redirect(
      buildSpotifyAuthUrl({
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri: SPOTIFY_REDIRECT_URI,
        codeChallenge,
        state,
        scopes: SPOTIFY_SCOPES,
      })
    );

    // Set secure cookie with PKCE data
    response.cookies.set("spotify_auth", spotifyAuthData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Spotify auth error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Spotify auth" },
      { status: 500 }
    );
  }
}
