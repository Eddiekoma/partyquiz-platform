/**
 * SpotifyAudioTarget — SDK Executor
 *
 * Architecture: "SDK is executor, server is conductor"
 *
 * The server NEVER calls the Spotify Web API for play/pause/seek/volume
 * on SDK devices. Instead:
 *  1. Server sends AUDIO_EXECUTE_COMMAND via WebSocket
 *  2. This component executes the command using Spotify SDK methods
 *  3. Sends AUDIO_ACK back to server with result
 *
 * For "play" (loading a specific track URI): the SDK has NO play(uri) method,
 * so we call the Spotify Web API from the CLIENT side using the SDK's own
 * device_id. This works reliably because the device is local to this browser.
 *
 * State machine:
 *   DISCONNECTED → SDK_READY → ACTIVATED → IDLE
 *        ↑                                  ↕
 *      not_ready                     EXECUTING → PLAYING / PAUSED
 *        ↑                               ↕
 *      error                        ERROR_RECOVERY
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import {
  AudioWSEvent,
  AudioTargetKind,
  AudioSDKState,
  type AudioExecuteCommand,
} from "@partyquiz/shared";
import {
  acquireSpotifyLock,
  releaseSpotifyLock,
  destroySpotifyLock,
} from "@/lib/spotifyTabLock";

// Spotify SDK Player type (avoids global declaration conflicts)
type SpotifySDKPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (data: any) => void) => boolean;
  removeListener: (event: string, callback?: (data: any) => void) => boolean;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getVolume: () => Promise<number>;
  getCurrentState: () => Promise<any | null>;
  activateElement: () => Promise<void>;
  togglePlay: () => Promise<void>;
};

interface SpotifyAudioTargetProps {
  sessionCode: string;
  kind: "HOST" | "DISPLAY";
  socket: Socket | null;
  onDeviceReady?: (deviceId: string) => void;
  onStatusChange?: (status: {
    isPlaying: boolean;
    trackId: string | null;
    positionMs: number;
    durationMs: number;
  }) => void;
  onError?: (error: string) => void;
  onTargetChanged?: (isTarget: boolean) => void;
  onNeedsActivation?: (needs: boolean) => void;
}

// ============================================================================
// SDK SCRIPT SINGLETON
// ============================================================================
let sdkLoaded = false;
let sdkReadyResolve: (() => void) | null = null;
const sdkReadyPromise = new Promise<void>((resolve) => {
  sdkReadyResolve = resolve;
});

function ensureSDKScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (sdkLoaded) return sdkReadyPromise;
  sdkLoaded = true;

  return new Promise<void>((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkReadyResolve?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  });
}

const HEARTBEAT_INTERVAL = 10_000;

export function SpotifyAudioTarget({
  sessionCode,
  kind,
  socket,
  onDeviceReady,
  onStatusChange,
  onError,
  onTargetChanged,
  onNeedsActivation,
}: SpotifyAudioTargetProps) {
  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTargetRef = useRef(false);
  const sdkStateRef = useRef<AudioSDKState>(AudioSDKState.DISCONNECTED);
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [, setIsActive] = useState(false);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const setSdkState = useCallback((newState: AudioSDKState) => {
    const prev = sdkStateRef.current;
    sdkStateRef.current = newState;
    if (prev !== newState) {
      console.log(`[SpotifyAudioTarget] State: ${prev} → ${newState}`);
      socket?.emit(AudioWSEvent.AUDIO_SDK_STATE_CHANGE, {
        sessionCode,
        state: newState,
        deviceId: deviceIdRef.current ?? undefined,
      });
    }
  }, [socket, sessionCode]);

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

  const clearAutoPauseTimer = useCallback(() => {
    if (autoPauseTimerRef.current) {
      clearTimeout(autoPauseTimerRef.current);
      autoPauseTimerRef.current = null;
    }
  }, []);

  // ============================================================================
  // SEND ACK BACK TO SERVER
  // ============================================================================

  const sendAck = useCallback((
    commandId: string,
    status: "ok" | "fail",
    extra?: {
      error?: string;
      isPlaying?: boolean;
      positionMs?: number;
      durationMs?: number;
      trackUri?: string;
    }
  ) => {
    socket?.emit(AudioWSEvent.AUDIO_ACK, {
      commandId,
      sessionCode,
      status,
      sdkState: sdkStateRef.current,
      ...extra,
    });
  }, [socket, sessionCode]);

  // ============================================================================
  // EXECUTE COMMANDS LOCALLY VIA SDK
  // ============================================================================

  /**
   * Play a specific track URI. The SDK has NO play(uri) method, so we call
   * the Spotify Web API from the CLIENT side with the SDK's own device_id.
   *
   * Strategy: Transfer + Play in ONE step.
   * The SDK device often isn't "active" in Spotify's backend even after
   * warm-up, because `play: false` transfers expire after a few seconds.
   *
   * So we: 1. Transfer with play:false THEN immediately play with device_id
   *         2. On 404: wait 2s + retry (Spotify propagation delay)
   *         3. On 401: refresh token + retry
   *         4. Fallback: play without device_id
   * Total time budget: < 8 seconds
   */
  const playTrackViaAPI = useCallback(async (
    trackUri: string,
    positionMs: number = 0
  ): Promise<void> => {
    let token = tokenRef.current || await getToken();
    const deviceId = deviceIdRef.current;
    if (!token || !deviceId) {
      throw new Error("No token or device_id available");
    }

    const playBody = JSON.stringify({
      uris: [trackUri],
      position_ms: positionMs,
    });

    const doPlay = async (t: string, withDeviceId = true): Promise<Response> => {
      const url = withDeviceId
        ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
        : `https://api.spotify.com/v1/me/player/play`;
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: playBody,
      });
    };

    const doTransfer = async (t: string): Promise<number> => {
      const res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      });
      return res.status;
    };

    console.log(`[SpotifyAudioTarget] playTrackViaAPI: ${trackUri} (pos=${positionMs})`);

    // Step 1: Always transfer first to ensure device is active, then play immediately
    console.log("[SpotifyAudioTarget] Step 1: Transfer + immediate play");
    const transferStatus = await doTransfer(token);
    console.log(`[SpotifyAudioTarget] Transfer status: ${transferStatus}`);

    // Small delay to let Spotify register the transfer
    await new Promise(r => setTimeout(r, 500));

    let res = await doPlay(token);
    console.log(`[SpotifyAudioTarget] Play attempt 1 status: ${res.status}`);

    // 401 → refresh token + retry
    if (res.status === 401) {
      console.warn("[SpotifyAudioTarget] Token expired, refreshing…");
      const newToken = await getToken();
      if (!newToken) throw new Error("Token refresh failed");
      token = newToken;
      res = await doPlay(token);
    }

    // 404 → device still not propagated, wait longer and retry
    if (res.status === 404) {
      console.warn("[SpotifyAudioTarget] Play 404 — waiting 2s for Spotify propagation…");
      await new Promise(r => setTimeout(r, 2000));
      res = await doPlay(token);
      console.log(`[SpotifyAudioTarget] Play attempt 2 status: ${res.status}`);
    }

    // Still 404 → try one more time with longer wait
    if (res.status === 404) {
      console.warn("[SpotifyAudioTarget] Play still 404 — waiting 3s more…");
      await new Promise(r => setTimeout(r, 3000));
      res = await doPlay(token);
      console.log(`[SpotifyAudioTarget] Play attempt 3 status: ${res.status}`);
    }

    // 502/503 → transient Spotify error, single retry after short wait
    if (res.status === 502 || res.status === 503) {
      console.warn(`[SpotifyAudioTarget] Spotify ${res.status}, retrying after 1s…`);
      await new Promise(r => setTimeout(r, 1000));
      res = await doPlay(token);
    }

    if (res.ok || res.status === 204) {
      console.log("[SpotifyAudioTarget] playTrackViaAPI ✓ success");
      return;
    }

    // Last resort: play WITHOUT device_id — Spotify uses whatever it considers active
    console.warn(`[SpotifyAudioTarget] All device_id attempts failed (${res.status}), trying without device_id…`);
    const fallbackRes = await doPlay(token, false);

    if (fallbackRes.ok || fallbackRes.status === 204) {
      console.log("[SpotifyAudioTarget] playTrackViaAPI ✓ success (fallback without device_id)");
      return;
    }

    const errBody = await fallbackRes.text().catch(() => "");
    throw new Error(`Spotify play failed: ${fallbackRes.status} ${errBody}`);
  }, [getToken]);

  /**
   * Handle AUDIO_EXECUTE_COMMAND from server
   */
  const executeCommand = useCallback(async (cmd: AudioExecuteCommand) => {
    const player = playerRef.current;
    if (!player) {
      console.warn("[SpotifyAudioTarget] No player for command:", cmd.action);
      sendAck(cmd.commandId, "fail", { error: "SDK player not initialized" });
      return;
    }

    const prevState = sdkStateRef.current;
    setSdkState(AudioSDKState.EXECUTING);

    try {
      switch (cmd.action) {
        case "play": {
          if (!cmd.trackUri) {
            // No URI = resume current track
            await player.resume();
          } else {
            // Play specific track via Web API (client-side call)
            await playTrackViaAPI(cmd.trackUri, cmd.positionMs ?? 0);
          }

          // Set up auto-pause timer if durationMs specified
          clearAutoPauseTimer();
          if (cmd.durationMs && cmd.durationMs > 0) {
            autoPauseTimerRef.current = setTimeout(async () => {
              try {
                await player.pause();
                setSdkState(AudioSDKState.PAUSED);
                onStatusChange?.({
                  isPlaying: false,
                  trackId: cmd.trackUri?.replace("spotify:track:", "") ?? null,
                  positionMs: (cmd.positionMs ?? 0) + (cmd.durationMs ?? 0),
                  durationMs: 0,
                });
              } catch (e) {
                console.warn("[SpotifyAudioTarget] Auto-pause error:", e);
              }
            }, cmd.durationMs);
          }

          setSdkState(AudioSDKState.PLAYING);
          sendAck(cmd.commandId, "ok", {
            isPlaying: true,
            positionMs: cmd.positionMs ?? 0,
            trackUri: cmd.trackUri,
          });

          onStatusChange?.({
            isPlaying: true,
            trackId: cmd.trackUri?.replace("spotify:track:", "") ?? null,
            positionMs: cmd.positionMs ?? 0,
            durationMs: cmd.durationMs ?? 0,
          });
          break;
        }

        case "resume": {
          await player.resume();
          setSdkState(AudioSDKState.PLAYING);
          const state = await player.getCurrentState();
          sendAck(cmd.commandId, "ok", {
            isPlaying: true,
            positionMs: state?.position ?? 0,
            durationMs: state?.duration ?? 0,
            trackUri: state?.track_window?.current_track?.uri,
          });
          onStatusChange?.({
            isPlaying: true,
            trackId: state?.track_window?.current_track?.id ?? null,
            positionMs: state?.position ?? 0,
            durationMs: state?.duration ?? 0,
          });
          break;
        }

        case "pause": {
          clearAutoPauseTimer();
          await player.pause();
          setSdkState(AudioSDKState.PAUSED);
          const state = await player.getCurrentState();
          sendAck(cmd.commandId, "ok", {
            isPlaying: false,
            positionMs: state?.position ?? 0,
            durationMs: state?.duration ?? 0,
            trackUri: state?.track_window?.current_track?.uri,
          });
          onStatusChange?.({
            isPlaying: false,
            trackId: state?.track_window?.current_track?.id ?? null,
            positionMs: state?.position ?? 0,
            durationMs: state?.duration ?? 0,
          });
          break;
        }

        case "seek": {
          const seekTo = cmd.positionMs ?? 0;
          await player.seek(seekTo);
          sendAck(cmd.commandId, "ok", { positionMs: seekTo });
          break;
        }

        case "volume": {
          const vol = cmd.volume ?? 0.8;
          await player.setVolume(vol);
          sendAck(cmd.commandId, "ok");
          break;
        }

        case "stop": {
          clearAutoPauseTimer();
          await player.pause();
          await player.seek(0);
          setSdkState(AudioSDKState.IDLE);
          sendAck(cmd.commandId, "ok", { isPlaying: false, positionMs: 0 });
          onStatusChange?.({
            isPlaying: false,
            trackId: null,
            positionMs: 0,
            durationMs: 0,
          });
          break;
        }

        default:
          sendAck(cmd.commandId, "fail", { error: `Unknown action: ${cmd.action}` });
          setSdkState(prevState);
      }
    } catch (err: any) {
      console.error(`[SpotifyAudioTarget] Command '${cmd.action}' failed:`, err);
      setSdkState(AudioSDKState.ERROR_RECOVERY);
      sendAck(cmd.commandId, "fail", { error: err?.message || "SDK command failed" });
      onError?.(err?.message || "Playback command failed");

      // Try to recover to IDLE after error
      setTimeout(() => {
        if (sdkStateRef.current === AudioSDKState.ERROR_RECOVERY && playerRef.current) {
          setSdkState(AudioSDKState.IDLE);
        }
      }, 2000);
    }
  }, [playTrackViaAPI, sendAck, setSdkState, clearAutoPauseTimer, onStatusChange, onError]);

  // ============================================================================
  // INITIALIZE SDK PLAYER
  // ============================================================================

  const initPlayer = useCallback(async () => {
    if (!socket) return;

    // Tab lock: only one tab per device should run SDK
    const hasLock = await acquireSpotifyLock(sessionCode, () => {
      console.log("[SpotifyAudioTarget] Lock revoked, tearing down SDK");
      teardownPlayer();
    });

    if (!hasLock) {
      console.log("[SpotifyAudioTarget] Could not acquire tab lock, skipping SDK init");
      return;
    }

    await ensureSDKScript();

    const token = await getToken();
    if (!token) {
      onError?.("No Spotify token available");
      return;
    }

    const player = new window.Spotify.Player({
      name: `PartyQuiz ${kind === "DISPLAY" ? "Display" : "Host"} - ${sessionCode}`,
      getOAuthToken: async (cb: (token: string) => void) => {
        const t = await getToken();
        cb(t || "");
      },
      volume: 0.8,
    });

    // ---- SDK EVENTS ----

    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      console.log("[SpotifyAudioTarget] SDK ready, device_id:", device_id);
      deviceIdRef.current = device_id;
      setSdkState(AudioSDKState.SDK_READY);
      onDeviceReady?.(device_id);

      // Warm-up: Register IMMEDIATELY — don't bother with transfer here.
      // The `play: false` transfer expires after a few seconds anyway,
      // so it's pointless. Instead, playTrackViaAPI handles transfer + play
      // in one atomic step when an actual play command arrives.
      (async () => {
        // Register with server right away
        socket.emit(AudioWSEvent.REGISTER_AUDIO_PLAYER, {
          sessionCode,
          deviceId: device_id,
          deviceName: `PartyQuiz ${kind}`,
          kind: kind === "DISPLAY" ? AudioTargetKind.DISPLAY : AudioTargetKind.HOST,
        });
        console.log("[SpotifyAudioTarget] Registered with server (no warm-up transfer)");

        // Start heartbeat
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          socket.emit(AudioWSEvent.AUDIO_HEARTBEAT, {
            sessionCode,
            deviceId: device_id,
          });
        }, HEARTBEAT_INTERVAL);

        // Transition to IDLE (ready to receive commands)
        setSdkState(AudioSDKState.IDLE);
      })();
    });

    player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
      console.warn("[SpotifyAudioTarget] Device went offline:", device_id);
      setSdkState(AudioSDKState.DISCONNECTED);
    });

    player.addListener("player_state_changed", (state: any) => {
      if (!state) return;
      const track = state.track_window?.current_track;
      const isPlaying = !state.paused;

      // Update SDK state based on actual playback
      if (sdkStateRef.current !== AudioSDKState.EXECUTING) {
        setSdkState(isPlaying ? AudioSDKState.PLAYING : AudioSDKState.PAUSED);
      }

      onStatusChange?.({
        isPlaying,
        trackId: track?.id ?? null,
        positionMs: state.position,
        durationMs: state.duration,
      });
    });

    // Autoplay failed — need user interaction
    player.addListener("autoplay_failed", () => {
      console.warn("[SpotifyAudioTarget] Autoplay blocked by browser — need user click");
      onNeedsActivation?.(true);
    });

    // Error handlers
    player.addListener("initialization_error", ({ message }: { message: string }) => {
      console.error("[SpotifyAudioTarget] Init error:", message);
      setSdkState(AudioSDKState.ERROR_RECOVERY);
      onError?.(message);
    });
    player.addListener("authentication_error", ({ message }: { message: string }) => {
      console.error("[SpotifyAudioTarget] Auth error:", message);
      setSdkState(AudioSDKState.ERROR_RECOVERY);
      onError?.(message);
    });
    player.addListener("account_error", ({ message }: { message: string }) => {
      console.error("[SpotifyAudioTarget] Account error:", message);
      setSdkState(AudioSDKState.ERROR_RECOVERY);
      onError?.("Spotify Premium required");
    });
    player.addListener("playback_error", ({ message }: { message: string }) => {
      console.error("[SpotifyAudioTarget] Playback error:", message);
      // Don't change state for playback errors — they might be transient
    });

    // Activate element for mobile/autoplay browsers (must be called before connect)
    await player.activateElement();
    setSdkState(AudioSDKState.ACTIVATED);

    const connected = await player.connect();
    if (!connected) {
      onError?.("Failed to connect to Spotify");
      setSdkState(AudioSDKState.DISCONNECTED);
      releaseSpotifyLock();
      return;
    }

    playerRef.current = player;
    onNeedsActivation?.(false);
    console.log("[SpotifyAudioTarget] SDK connected, waiting for 'ready' event");
  }, [socket, sessionCode, kind, getToken, setSdkState, onDeviceReady, onStatusChange, onError, onNeedsActivation]);

  // ============================================================================
  // TEARDOWN
  // ============================================================================

  const teardownPlayer = useCallback(() => {
    clearAutoPauseTimer();

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (playerRef.current) {
      if (socket && deviceIdRef.current) {
        socket.emit(AudioWSEvent.UNREGISTER_AUDIO_PLAYER, { sessionCode });
      }
      playerRef.current.disconnect();
      playerRef.current = null;
    }

    deviceIdRef.current = null;
    tokenRef.current = null;
    setSdkState(AudioSDKState.DISCONNECTED);
    releaseSpotifyLock();
  }, [socket, sessionCode, setSdkState, clearAutoPauseTimer]);

  // ============================================================================
  // SOCKET EVENT LISTENERS
  // ============================================================================

  useEffect(() => {
    if (!socket) return;

    // Server tells us when the audio target changes
    const handleTargetChanged = (data: {
      kind: string;
      deviceId: string | null;
      socketId?: string;
    }) => {
      const thisIsTarget =
        (data.kind === AudioTargetKind.DISPLAY && kind === "DISPLAY") ||
        (data.kind === AudioTargetKind.HOST && kind === "HOST");

      const wasTarget = isTargetRef.current;
      isTargetRef.current = thisIsTarget;
      setIsActive(thisIsTarget);
      onTargetChanged?.(thisIsTarget);

      // If we became the target and don't have SDK yet, initialize
      if (thisIsTarget && !playerRef.current) {
        initPlayer();
      }
      // If we're no longer the target, teardown
      if (!thisIsTarget && wasTarget && playerRef.current) {
        teardownPlayer();
      }
    };

    // SERVER → SDK CLIENT: execute a command locally
    const handleExecuteCommand = (data: unknown) => {
      try {
        // Type-assert — server already validated with schema
        const cmd = data as AudioExecuteCommand;
        console.log(`[SpotifyAudioTarget] EXECUTE_COMMAND: ${cmd.action} (id=${cmd.commandId})`);
        executeCommand(cmd);
      } catch (err: any) {
        console.error("[SpotifyAudioTarget] Failed to parse execute command:", err);
      }
    };

    // Audio error from server
    const handleAudioError = (data: {
      code: string;
      message: string;
      needsActivation: boolean;
    }) => {
      if (data.code === "NO_AUDIO_TARGET") {
        console.info("[SpotifyAudioTarget] No audio target active — set one via AudioBar.");
        return;
      }
      console.warn("[SpotifyAudioTarget] Server error:", data.code, data.message);
      if (data.needsActivation) {
        onNeedsActivation?.(true);
      }
      onError?.(data.message);
    };

    socket.on(AudioWSEvent.AUDIO_TARGET_CHANGED, handleTargetChanged);
    socket.on(AudioWSEvent.AUDIO_EXECUTE_COMMAND, handleExecuteCommand);
    socket.on(AudioWSEvent.AUDIO_ERROR, handleAudioError);

    // Request current target state on mount
    socket.emit(AudioWSEvent.GET_AUDIO_TARGET, { sessionCode });

    return () => {
      socket.off(AudioWSEvent.AUDIO_TARGET_CHANGED, handleTargetChanged);
      socket.off(AudioWSEvent.AUDIO_EXECUTE_COMMAND, handleExecuteCommand);
      socket.off(AudioWSEvent.AUDIO_ERROR, handleAudioError);
    };
  }, [socket, sessionCode, kind, initPlayer, teardownPlayer, executeCommand, onStatusChange, onError, onTargetChanged, onNeedsActivation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownPlayer();
      destroySpotifyLock();
    };
  }, [teardownPlayer]);

  // Handle manual audio activation request from UI (mobile browsers)
  useEffect(() => {
    const handleActivationRequest = async () => {
      const player = playerRef.current;
      if (player && sdkStateRef.current !== AudioSDKState.DISCONNECTED) {
        try {
          console.log('[SpotifyAudioTarget] Manual activation request received');
          await player.activateElement();
          setIsActive(true);
          onNeedsActivation?.(false);
          setSdkState(AudioSDKState.ACTIVATED);
        } catch (err) {
          console.error('[SpotifyAudioTarget] Manual activation failed:', err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('spotify-activate-request', handleActivationRequest);
      return () => {
        window.removeEventListener('spotify-activate-request', handleActivationRequest);
      };
    }
  }, [onNeedsActivation, setSdkState]);

  // Headless component — renders nothing
  return null;
}

export default SpotifyAudioTarget;
