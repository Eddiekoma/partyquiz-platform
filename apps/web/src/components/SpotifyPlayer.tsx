/**
 * Spotify Audio Player Component
 * Plays Spotify track previews (30 second clips)
 * Uses HTML5 Audio API with Spotify preview URLs
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface SpotifyPlayerProps {
  /** Spotify track ID */
  trackId: string;
  /** Direct preview URL (30s clip) */
  previewUrl?: string | null;
  /** Album art URL */
  albumArt?: string | null;
  /** Track title */
  title?: string;
  /** Artist name */
  artist?: string;
  /** Start position in ms (default 0) */
  startMs?: number;
  /** Duration to play in ms (default 30000) */
  durationMs?: number;
  /** Auto-play on mount */
  autoplay?: boolean;
  /** Show controls */
  controls?: boolean;
  /** Callback when track starts playing */
  onPlay?: () => void;
  /** Callback when track ends or duration reached */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function SpotifyPlayer({
  trackId,
  previewUrl,
  albumArt,
  title,
  artist,
  startMs = 0,
  durationMs = 30000,
  autoplay = false,
  controls = true,
  onPlay,
  onEnd,
  onError,
  className = "",
}: SpotifyPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate the actual end time based on startMs and durationMs
  const endTimeSeconds = (startMs + durationMs) / 1000;

  // Handle time updates to enforce duration limit
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Check if we've reached the duration limit
      if (audio.currentTime >= endTimeSeconds) {
        audio.pause();
        setIsPlaying(false);
        onEnd?.();
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      
      // Seek to start position
      if (startMs > 0) {
        audio.currentTime = startMs / 1000;
      }
      
      // Auto-play if requested
      if (autoplay) {
        audio.play().catch((err) => {
          console.error("Autoplay blocked:", err);
          setError("Autoplay was blocked. Click play to start.");
        });
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnd?.();
    };

    const handleError = () => {
      const errorMsg = "Failed to load audio preview";
      setError(errorMsg);
      setIsLoading(false);
      onError?.(errorMsg);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [autoplay, startMs, endTimeSeconds, onPlay, onEnd, onError]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Play failed:", err);
        setError("Failed to play audio");
      });
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / Math.min(duration, endTimeSeconds)) * 100 : 0;

  if (!previewUrl) {
    return (
      <div className={`bg-slate-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-4">
          {albumArt && (
            <img 
              src={albumArt} 
              alt={title || "Album art"} 
              className="w-16 h-16 rounded shadow-lg"
            />
          )}
          <div className="flex-1">
            {title && <p className="font-semibold text-white">{title}</p>}
            {artist && <p className="text-sm text-slate-400">{artist}</p>}
            <p className="text-sm text-yellow-500 mt-2">
              ⚠️ Preview not available for this track
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg p-4 ${className}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={previewUrl}
        preload="auto"
        crossOrigin="anonymous"
      />

      <div className="flex items-center gap-4">
        {/* Album Art */}
        {albumArt && (
          <div className="relative">
            <img 
              src={albumArt} 
              alt={title || "Album art"} 
              className="w-16 h-16 rounded shadow-lg"
            />
            {/* Spotify logo overlay */}
            <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-1">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Track Info & Controls */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold text-white truncate">{title}</p>
          )}
          {artist && (
            <p className="text-sm text-slate-400 truncate">{artist}</p>
          )}

          {error ? (
            <p className="text-sm text-red-400 mt-2">{error}</p>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(Math.min(duration, endTimeSeconds))}</span>
              </div>
            </>
          )}
        </div>

        {/* Play/Pause Button */}
        {controls && !error && (
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 disabled:bg-slate-600 transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Fetch Spotify track data from our API
 */
export async function fetchSpotifyTrack(trackId: string): Promise<{
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  previewUrl: string | null;
  durationMs: number;
} | null> {
  try {
    const response = await fetch(`/api/spotify/track/${trackId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
