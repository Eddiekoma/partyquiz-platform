"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export function SpotifyConnectCard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSpotifyConnection();
  }, []);

  const checkSpotifyConnection = async () => {
    try {
      setLoading(true);
      // Check if user has Spotify tokens
      const response = await fetch("/api/auth/session");
      const session = await response.json();
      
      // User is considered connected if they have spotifyAccessToken
      setConnected(!!session?.user?.spotifyAccessToken);
    } catch (error) {
      console.error("Failed to check Spotify connection:", error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to Spotify OAuth flow
    window.location.href = "/api/spotify/auth";
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Spotify? You'll need to reconnect to use music features.")) {
      return;
    }

    try {
      setLoading(true);
      // In a real implementation, this would call an API to clear Spotify tokens
      // For now, we'll just show a message
      alert("To disconnect Spotify, please contact support or clear tokens manually.");
      // TODO: Implement /api/spotify/disconnect endpoint
    } catch (error) {
      console.error("Failed to disconnect:", error);
      setError("Failed to disconnect Spotify");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🎵 Spotify Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>🎵 Spotify Integration</CardTitle>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-green-800">Connected to Spotify</p>
                <p className="text-sm text-green-700">
                  You can now search for tracks and use music questions
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Disconnect Spotify
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connect your Spotify account to search for tracks and create music-based questions.
            </p>
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-lg">ℹ️</span>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">What you can do with Spotify:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Search millions of tracks</li>
                  <li>Create "Guess the Song" questions</li>
                  <li>Use 30-second track previews</li>
                  <li>Add album artwork to questions</li>
                </ul>
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">🎧</span>
              Connect Spotify
            </button>
            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
