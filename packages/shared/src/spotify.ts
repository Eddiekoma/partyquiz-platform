/**
 * Spotify OAuth PKCE (Proof Key for Code Exchange) utilities
 * Following new Spotify OAuth requirements (deadline Nov 27, 2025)
 * @see https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

import crypto from "crypto";

/**
 * Generate a random code verifier for PKCE
 * @returns Base64url-encoded string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  const buffer = crypto.randomBytes(32);
  return base64URLEncode(buffer);
}

/**
 * Generate code challenge from verifier using SHA-256
 * @param verifier Code verifier
 * @returns Base64url-encoded SHA-256 hash
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64URLEncode(hash);
}

/**
 * Base64URL-encode a buffer (no padding, URL-safe)
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Build Spotify authorization URL for PKCE flow
 */
export function buildSpotifyAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes?: string[];
}): string {
  const { clientId, redirectUri, codeChallenge, state, scopes = [] } = params;

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("state", state);

  if (scopes.length > 0) {
    url.searchParams.set("scope", scopes.join(" "));
  }

  return url.toString();
}

/**
 * Exchange authorization code for access token using PKCE
 */
export async function exchangeCodeForToken(params: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<SpotifyTokenResponse> {
  const { clientId, code, redirectUri, codeVerifier } = params;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string; error_description?: string };
    throw new Error(`Spotify token exchange failed: ${error.error_description || error.error}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(params: {
  clientId: string;
  refreshToken: string;
}): Promise<SpotifyTokenResponse> {
  const { clientId, refreshToken } = params;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string; error_description?: string };
    throw new Error(`Spotify token refresh failed: ${error.error_description || error.error}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

/**
 * Spotify token response
 */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number; // Seconds
  refresh_token?: string;
  scope: string;
}

/**
 * Spotify track info for quiz questions
 */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
    release_date: string; // YYYY-MM-DD
  };
  duration_ms: number;
  uri: string; // spotify:track:xxx
  external_urls: {
    spotify: string; // Web player URL
  };
}
