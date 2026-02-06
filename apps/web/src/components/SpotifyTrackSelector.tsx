"use client";

import { useState } from "react";
import Image from "next/image";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
    release_date: string;
  };
  preview_url: string | null;
}

interface SpotifyTrackSelectorProps {
  onSelect: (track: SpotifyTrack) => void;
  selectedTrack?: SpotifyTrack | null;
}

export function SpotifyTrackSelector({ onSelect, selectedTrack }: SpotifyTrackSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`);
      
      if (!response.ok) {
        throw new Error("Failed to search Spotify");
      }

      const data = await response.json();
      setResults(data.tracks?.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to search Spotify");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const playPreview = (trackId: string, previewUrl: string | null) => {
    if (!previewUrl) return;

    if (previewingTrackId === trackId) {
      // Stop preview
      const audio = document.getElementById(`audio-${trackId}`) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPreviewingTrackId(null);
    } else {
      // Stop any other playing audio
      if (previewingTrackId) {
        const prevAudio = document.getElementById(`audio-${previewingTrackId}`) as HTMLAudioElement;
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }
      }

      // Play new preview
      const audio = document.getElementById(`audio-${trackId}`) as HTMLAudioElement;
      if (audio) {
        audio.play();
        setPreviewingTrackId(trackId);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected Track */}
      {selectedTrack && (
        <div className="border border-green-500 bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <p className="text-sm font-medium text-green-900">Selected Track</p>
          </div>
          <div className="flex items-center gap-4">
            {selectedTrack.album.images[0] && (
              <Image
                src={selectedTrack.album.images[0].url}
                alt={selectedTrack.album.name}
                width={64}
                height={64}
                className="rounded-md shadow-md"
              />
            )}
            <div>
              <p className="font-semibold text-white">{selectedTrack.name}</p>
              <p className="text-sm text-slate-400">{selectedTrack.artists.map((a) => a.name).join(", ")}</p>
              <p className="text-xs text-slate-400">{selectedTrack.album.name} ({new Date(selectedTrack.album.release_date).getFullYear()})</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="border border-slate-600 rounded-lg p-4 bg-slate-800/50">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          🎵 Search Spotify
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter track name, artist..."
            className="flex-1 px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSearching ? "⏳ Searching..." : "🔍 Search"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-3">
          <p className="text-red-800 text-sm">❌ {error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="border border-slate-600 rounded-lg p-4 bg-slate-800">
          <p className="text-sm font-medium text-slate-300 mb-3">Search Results ({results.length})</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((track) => (
              <div
                key={track.id}
                className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
                  selectedTrack?.id === track.id
                    ? "border-green-500 bg-green-50"
                    : "border-slate-700 hover:border-blue-400 hover:bg-blue-50"
                }`}
                onClick={() => onSelect(track)}
              >
                {/* Album Art */}
                {track.album.images[2] && (
                  <Image
                    src={track.album.images[2].url}
                    alt={track.album.name}
                    width={48}
                    height={48}
                    className="rounded shadow-sm"
                  />
                )}

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{track.name}</p>
                  <p className="text-sm text-slate-400 truncate">{track.artists.map((a) => a.name).join(", ")}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {track.album.name} · {new Date(track.album.release_date).getFullYear()}
                  </p>
                </div>

                {/* Preview Button */}
                {track.preview_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(track.id, track.preview_url);
                    }}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      previewingTrackId === track.id
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-slate-600 text-slate-300 hover:bg-gray-300"
                    }`}
                  >
                    {previewingTrackId === track.id ? "⏸️ Stop" : "▶️ Preview"}
                  </button>
                )}

                {/* Hidden Audio Element */}
                {track.preview_url && (
                  <audio
                    id={`audio-${track.id}`}
                    src={track.preview_url}
                    onEnded={() => setPreviewingTrackId(null)}
                  />
                )}

                {/* Selected Indicator */}
                {selectedTrack?.id === track.id && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!isSearching && searchQuery && results.length === 0 && !error && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-4xl mb-2">🔍</p>
          <p>No results found for &quot;{searchQuery}&quot;</p>
        </div>
      )}
    </div>
  );
}
