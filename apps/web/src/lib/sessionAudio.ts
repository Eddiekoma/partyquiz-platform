/**
 * Session Audio — Central client API for audio commands
 *
 * ONE place to send audio commands to the server AudioController.
 * All play buttons (track card, AudioBar, minigames) use this API.
 *
 * Why?
 * - No local SDK playback — everything goes via server → Spotify Player API
 * - Single command flow means consistent state & easier debugging
 * - Includes track metadata so the server can persist lastPlayable
 */

import type { Socket } from "socket.io-client";
import { AudioWSEvent, type AudioReason } from "@partyquiz/shared";

export interface PlayTrackParams {
  trackUri?: string;
  trackId?: string;
  positionMs?: number;
  durationMs?: number;
  trackName?: string;
  artistName?: string;
  albumArt?: string;
  reason?: AudioReason;
}

/**
 * Create a session audio API bound to a socket + session code.
 *
 * Usage:
 *   const audio = createSessionAudio(socket, "ABCDEF");
 *   audio.playTrack({ trackId: "xxx", reason: "HOST_PREVIEW" });
 *   audio.pause();
 *   audio.setVolume(0.7);
 */
export function createSessionAudio(socket: Socket | null, sessionCode: string) {
  const emit = (action: string, extra?: Record<string, unknown>) => {
    if (!socket) {
      console.warn("[sessionAudio] No socket connected, cannot send command:", action);
      return;
    }
    socket.emit(AudioWSEvent.AUDIO_COMMAND, {
      sessionCode,
      action,
      ...extra,
    });
  };

  return {
    /**
     * Play a specific track (used by track cards, question auto-play, etc.)
     */
    playTrack(params: PlayTrackParams) {
      emit("play", {
        trackUri: params.trackUri,
        trackId: params.trackId,
        positionMs: params.positionMs ?? 0,
        durationMs: params.durationMs,
        trackName: params.trackName,
        artistName: params.artistName,
        albumArt: params.albumArt,
        reason: params.reason ?? "UNKNOWN",
      });
    },

    /**
     * Pause playback
     */
    pause() {
      emit("pause", { reason: "AUDIOBAR" });
    },

    /**
     * Resume playback (continues where it left off)
     */
    resume() {
      emit("resume", { reason: "AUDIOBAR" });
    },

    /**
     * Stop playback entirely (clears current track, keeps lastPlayable)
     */
    stop() {
      emit("stop", { reason: "AUDIOBAR" });
    },

    /**
     * Set volume (0..1 range, NOT 0..100)
     */
    setVolume(vol01: number) {
      emit("volume", { volume: Math.max(0, Math.min(1, vol01)) });
    },

    /**
     * Seek to a position in the current track
     */
    seek(positionMs: number) {
      emit("seek", { positionMs });
    },

    /**
     * Restart the last played track from its original start position
     * Useful when no current track is active but user wants to replay
     */
    restartLast() {
      emit("restartLast", { reason: "AUDIOBAR" });
    },
  };
}

export type SessionAudio = ReturnType<typeof createSessionAudio>;
