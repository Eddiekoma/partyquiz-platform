/**
 * Spotify Web Player Component
 * Uses the Spotify Web Playback SDK to play full tracks in the browser.
 * 
 * NOTE: Spotify has deprecated preview_url (returns null for virtually all tracks
 * since late 2024). This component uses the Web Playback SDK exclusively.
 * preview_url / 30s clips are NOT supported.
 * 
 * Requirements:
 * - Spotify Premium account (required for Web Playback SDK)
 * - User must have authorized with 'streaming' scope
 * - Browser must support EME (Encrypted Media Extensions)
 * 
 * Fallback: If SDK fails or user has no Premium, shows a deep link to open
 * the track in the Spotify app.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Extend Window for Spotify SDK types
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
        /** Enable Media Session API for native browser media controls */
        enableMediaSession?: boolean;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (data: any) => void) => boolean;
  removeListener: (event: string, callback?: (data: any) => void) => boolean;
  on: (event: string, callback: (data: any) => void) => boolean;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getVolume: () => Promise<number>;
  setName: (name: string) => Promise<void>;
  getCurrentState: () => Promise<WebPlaybackState | null>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  /** Required for mobile — call on user interaction to allow autoplay on transfer */
  activateElement: () => Promise<void>;
}

interface WebPlaybackState {
  context: { uri: string | null; metadata: Record<string, unknown> | null };
  disallows: Record<string, boolean>;
  paused: boolean;
  position: number;
  duration: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: WebPlaybackTrack;
    previous_tracks: WebPlaybackTrack[];
    next_tracks: WebPlaybackTrack[];
  };
}

interface WebPlaybackTrack {
  uri: string;
  id: string | null;
  type: "track" | "episode" | "ad";
  media_type: "audio" | "video";
  name: string;
  is_playable: boolean;
  album: {
    uri: string;
    name: string;
    images: { url: string }[];
  };
  artists: { uri: string; name: string }[];
}

interface SpotifyWebPlayerProps {
  /** Spotify track ID */
  trackId: string;
  /** Album art URL */
  albumArt?: string | null;
  /** Track title */
  title?: string;
  /** Artist name */
  artist?: string;
  /** Auto-play on ready */
  autoplay?: boolean;
  /** Start position in milliseconds (for quiz: play from specific part of track) */
  startPositionMs?: number;
  /** Playback duration limit in milliseconds (auto-pause after this) */
  playDurationMs?: number;
  /** Callback when track starts playing */
  onPlay?: () => void;
  /** Callback when track pauses */
  onPause?: () => void;
  /** Callback when playback ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Callback when SDK device is ready */
  onDeviceReady?: (deviceId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// Track if SDK script is already loaded
let sdkScriptLoaded = false;
let sdkResolveGlobal: (() => void) | null = null;
const sdkReadyPromise = new Promise<void>((resolve) => {
  sdkResolveGlobal = resolve;
});

function loadSpotifySDK() {
  if (sdkScriptLoaded) return sdkReadyPromise;
  sdkScriptLoaded = true;

  return new Promise<void>((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkResolveGlobal?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  });
}

export function SpotifyWebPlayer({
  trackId,
  albumArt,
  title,
  artist,
  autoplay = false,
  startPositionMs = 0,
  playDurationMs,
  onPlay,
  onPause,
  onEnd,
  onError,
  onDeviceReady,
  className = "",
}: SpotifyWebPlayerProps) {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPlayingRef = useRef(false);
  const playStartTimeRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [showVolume, setShowVolume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [isPremium, setIsPremium] = useState(true);

  // Fetch access token
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/spotify/token");
      if (!res.ok) return null;
      const data = await res.json();
      tokenRef.current = data.accessToken;
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  // Play track via Spotify Connect API (with retry for device not yet registered)
  const playTrack = useCallback(async (trackIdToPlay: string, devId: string, posMs?: number, retriesLeft = 3): Promise<boolean> => {
    try {
      const res = await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: trackIdToPlay,
          deviceId: devId,
          action: "play",
          positionMs: posMs ?? startPositionMs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.premium === false) {
          setIsPremium(false);
          return false;
        }
        // Device not yet registered with Spotify servers — retry after delay
        if (data.noDevice && retriesLeft > 0) {
          console.log(`[SpotifyWebPlayer] Device not ready, retrying in 1s (${retriesLeft} retries left)`);
          await new Promise((r) => setTimeout(r, 1000));
          return playTrack(trackIdToPlay, devId, posMs, retriesLeft - 1);
        }
        throw new Error(data.error || "Failed to play");
      }

      return true;
    } catch (err: any) {
      console.error("Play track error:", err);
      return false;
    }
  }, [startPositionMs]);

  // Initialize SDK player
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = await getToken();
      if (!token || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        await loadSpotifySDK();
        if (cancelled) return;

        const player = new window.Spotify.Player({
          name: "PartyQuiz Player",
          // SDK calls this on connect() AND when token expires (max 60 min).
          // Always fetch a fresh token to avoid using expired cached ones.
          getOAuthToken: (cb) => {
            getToken().then((t) => {
              if (t) cb(t);
            });
          },
          volume: volume,
          // Enable native browser media controls (play/pause in notification area)
          enableMediaSession: true,
        });

        playerRef.current = player;

        // ─── Ready: device registered with Spotify Connect ────────
        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          console.log("[SpotifyWebPlayer] Ready with device:", device_id);
          deviceIdRef.current = device_id;
          setSdkConnected(true);
          setIsLoading(false);
          onDeviceReady?.(device_id);

          if (autoplay && trackId) {
            playTrack(trackId, device_id).then((success) => {
              if (success) {
                playStartTimeRef.current = Date.now();
              } else if (!cancelled) {
                setError("Kon nummer niet afspelen");
              }
            });
          }
        });

        // ─── Not Ready: connection lost ───────────────────────────
        player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
          console.log("[SpotifyWebPlayer] Device went offline:", device_id);
          setSdkConnected(false);
        });

        // ─── Player State Changed ─────────────────────────────────
        player.addListener("player_state_changed", (state: WebPlaybackState | null) => {
          if (!state) return;

          const nowPlaying = !state.paused;
          const wasPreviouslyPlaying = wasPlayingRef.current;

          setIsPlaying(nowPlaying);
          setCurrentTime(state.position);
          setDuration(state.duration);

          // Detect track end: was playing, now paused, position reset to 0
          if (wasPreviouslyPlaying && state.paused && state.position === 0) {
            onEnd?.();
          } else if (nowPlaying && !wasPreviouslyPlaying) {
            onPlay?.();
            if (!playStartTimeRef.current) {
              playStartTimeRef.current = Date.now();
            }
          } else if (!nowPlaying && wasPreviouslyPlaying) {
            onPause?.();
          }

          wasPlayingRef.current = nowPlaying;
        });

        // ─── Autoplay Failed (mobile browsers block autoplay) ─────
        player.addListener("autoplay_failed", () => {
          console.warn("[SpotifyWebPlayer] Autoplay blocked by browser. User interaction needed.");
          // Don't set error - just means user needs to click play manually
          setIsPlaying(false);
          setIsLoading(false);
        });

        // ─── Error Events ─────────────────────────────────────────
        player.addListener("initialization_error", ({ message }: { message: string }) => {
          console.error("[SpotifyWebPlayer] Init error:", message);
          setIsLoading(false);
          setError("Spotify SDK kon niet initialiseren");
          onError?.("initialization_error: " + message);
        });

        player.addListener("authentication_error", ({ message }: { message: string }) => {
          console.error("[SpotifyWebPlayer] Auth error:", message);
          // SDK will call getOAuthToken again automatically,
          // but if that also fails, show error
          getToken().then((newToken) => {
            if (!newToken) {
              setIsLoading(false);
              setError("Spotify authenticatie mislukt. Koppel opnieuw.");
              onError?.("authentication_error: " + message);
            }
          });
        });

        player.addListener("account_error", ({ message }: { message: string }) => {
          console.error("[SpotifyWebPlayer] Account error (no Premium?):", message);
          setIsPremium(false);
          setIsLoading(false);
          onError?.("account_error: " + message);
        });

        player.addListener("playback_error", ({ message }: { message: string }) => {
          console.error("[SpotifyWebPlayer] Playback error:", message);
          setError("Afspelen mislukt. Probeer opnieuw.");
          onError?.("playback_error: " + message);
        });

        // ─── Connect ──────────────────────────────────────────────
        const connected = await player.connect();
        if (!connected && !cancelled) {
          console.error("[SpotifyWebPlayer] Failed to connect");
          setIsLoading(false);
          setError("Kon niet verbinden met Spotify");
        }
      } catch (err) {
        console.error("[SpotifyWebPlayer] SDK init error:", err);
        setIsLoading(false);
        setError("Spotify SDK laden mislukt");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.pause().catch(() => {});
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Position polling when playing + duration limit enforcement
  useEffect(() => {
    if (sdkConnected && isPlaying) {
      positionIntervalRef.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState();
        if (state) {
          setCurrentTime(state.position);
          setDuration(state.duration);

          // Auto-pause after playDurationMs if configured (for quiz: play only X seconds)
          if (playDurationMs && playStartTimeRef.current) {
            const elapsed = Date.now() - playStartTimeRef.current;
            if (elapsed >= playDurationMs) {
              console.log("[SpotifyWebPlayer] Play duration limit reached, pausing");
              playerRef.current?.pause();
              playStartTimeRef.current = null;
              onEnd?.();
            }
          }
        }
      }, 500);
    } else if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, [sdkConnected, isPlaying]);

  // Toggle play/pause — also calls activateElement for mobile autoplay support
  const togglePlay = useCallback(async () => {
    const player = playerRef.current;
    const deviceId = deviceIdRef.current;
    if (!player || !deviceId) return;

    // activateElement() is required for mobile browsers to allow autoplay
    // when playback is transferred from other Spotify clients.
    // Must be called from a user interaction (click handler).
    await player.activateElement();

    if (isPlaying) {
      await player.pause();
    } else {
      const state = await player.getCurrentState();
      if (!state) {
        // No active playback — start fresh with the track
        const success = await playTrack(trackId, deviceId);
        if (success) {
          playStartTimeRef.current = Date.now();
        } else {
          setError("Kon nummer niet afspelen");
        }
      } else {
        await player.resume();
        if (!playStartTimeRef.current) {
          playStartTimeRef.current = Date.now();
        }
      }
    }
  }, [isPlaying, trackId, playTrack]);

  // Volume change
  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    if (playerRef.current) {
      await playerRef.current.setVolume(newVolume);
    }
  }, []);

  // Seek
  const handleSeek = useCallback(async (positionMs: number) => {
    if (playerRef.current) {
      await playerRef.current.seek(positionMs);
      setCurrentTime(positionMs);
    }
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ─── LINK FALLBACK: No Premium or SDK failed ─────────────────
  if (!isPremium || (error && !sdkConnected)) {
    return (
      <div className={`bg-slate-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-4">
          {albumArt && (
            <img src={albumArt} alt={title || "Album"} className="w-16 h-16 rounded shadow-lg" />
          )}
          <div className="flex-1">
            {title && <p className="font-semibold text-white">{title}</p>}
            {artist && <p className="text-sm text-slate-400">{artist}</p>}
            {!isPremium && (
              <p className="text-sm text-amber-400 mt-1">
                ⚠️ Spotify Premium is vereist voor afspelen in de browser
              </p>
            )}
            {error && isPremium && (
              <p className="text-sm text-red-400 mt-1">⚠️ {error}</p>
            )}
            <a
              href={`https://open.spotify.com/track/${trackId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Open in Spotify
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── SDK PLAYER UI ──────────────────────────────────────────
  return (
    <div className={`bg-slate-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Album Art */}
        {albumArt && (
          <div className="relative shrink-0">
            <img src={albumArt} alt={title || "Album"} className="w-16 h-16 rounded shadow-lg" />
          </div>
        )}

        {/* Track Info & Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {title && <p className="font-semibold text-white truncate">{title}</p>}
          </div>
          {artist && <p className="text-sm text-slate-400 truncate">{artist}</p>}

          {error && sdkConnected ? (
            <div className="mt-2">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-green-400 hover:text-green-300 mt-1 underline"
              >
                Opnieuw proberen
              </button>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div 
                className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  handleSeek(pct * duration);
                }}
              >
                <div
                  className="h-full bg-green-500 transition-all duration-200"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </>
          )}
        </div>

        {/* Play/Pause Button */}
        {!(error && sdkConnected) && (
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 disabled:bg-slate-600 transition-colors shrink-0"
            aria-label={isPlaying ? "Pauze" : "Afspelen"}
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

        {/* Volume Control */}
        {!(error && sdkConnected) && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors"
              aria-label="Volume"
            >
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                {volume === 0 ? (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                ) : volume < 0.5 ? (
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                )}
              </svg>
            </button>
            {showVolume && (
              <div className="absolute bottom-full right-0 mb-2 bg-slate-700 rounded-lg p-3 shadow-xl z-10">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
