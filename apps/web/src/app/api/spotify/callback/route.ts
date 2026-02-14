/**
 * Spotify OAuth PKCE - Callback handler
 * Receives authorization code and exchanges for access token
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@partyquiz/shared";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 
  (process.env.APP_BASE_URL || "http://127.0.0.1:3000") + "/api/spotify/callback";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle user denial
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard?spotify_error=${error}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard?spotify_error=missing_parameters", request.url)
      );
    }

    // Retrieve PKCE data from cookie
    const spotifyAuthCookie = request.cookies.get("spotify_auth");
    if (!spotifyAuthCookie) {
      return NextResponse.redirect(
        new URL("/dashboard?spotify_error=session_expired", request.url)
      );
    }

    const { codeVerifier, state: storedState } = JSON.parse(spotifyAuthCookie.value);

    // Verify state to prevent CSRF
    if (state !== storedState) {
      return NextResponse.redirect(
        new URL("/dashboard?spotify_error=invalid_state", request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken({
      clientId: SPOTIFY_CLIENT_ID,
      code,
      redirectUri: SPOTIFY_REDIRECT_URI,
      codeVerifier,
    });

    // Get current user session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL("/dashboard?spotify_error=not_authenticated", request.url)
      );
    }

    // Store Spotify tokens in database (encrypted in production!)
    // TODO: Encrypt tokens using crypto.encrypt() before storing
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        spotifyAccessToken: tokenResponse.access_token,
        spotifyRefreshToken: tokenResponse.refresh_token || undefined,
        spotifyTokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000),
      },
    });

    // Clear auth cookie
    const response = NextResponse.redirect(
      new URL("/dashboard?spotify_connected=true", request.url)
    );
    response.cookies.delete("spotify_auth");

    return response;
  } catch (error) {
    console.error("Spotify callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?spotify_error=token_exchange_failed", request.url)
    );
  }
}
