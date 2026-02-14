"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export function SpotifyConnectCard() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSpotifyConnection();
  }, []);

  const checkSpotifyConnection = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/session");
      const session = await response.json();
      setConnected(!!session?.user?.spotifyConnected);
    } catch (error) {
      console.error("Failed to check Spotify connection:", error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/spotify/auth";
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Spotify? You'll need to reconnect to use music features.")) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/spotify/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }
      setConnected(false);
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
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
            <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-green-400">Connected to Spotify</p>
                <p className="text-sm text-green-300/80">
                  You can now search for tracks and use music questions
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-sm text-red-400 border border-red-700/50 rounded-lg hover:bg-red-900/30 transition-colors"
            >
              Disconnect Spotify
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400">
              Connect your Spotify account to search for tracks and create music-based questions.
            </p>
            <div className="flex items-start gap-2 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
              <span className="text-lg">ℹ️</span>
              <div className="text-sm text-slate-300">
                <p className="font-semibold mb-1">What you can do with Spotify:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Search millions of tracks</li>
                  <li>Create &quot;Guess the Song&quot; questions</li>
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
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
