/**
 * Audio Target System - Types & Events
 * 
 * Implements the "Session Audio Target" architecture:
 * - Per session, exactly ONE device is the audio target (runs Spotify SDK)
 * - All audio commands go through the server AudioController
 * - Server is the source of truth for which device plays audio
 * - Command queue ensures Spotify Player API calls are serialized
 */

import { z } from "zod";

// ============================================================================
// ENUMS & TYPES
// ============================================================================

/**
 * What kind of client is the audio target
 */
export enum AudioTargetKind {
  HOST = "HOST",
  DISPLAY = "DISPLAY",
  CONNECT_DEVICE = "CONNECT_DEVICE", // External Spotify Connect device
  NONE = "NONE",
}

/**
 * Audio playback status
 */
export enum AudioPlaybackStatus {
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
  LOADING = "LOADING",
  ERROR = "ERROR",
}

/**
 * Why audio is playing (for debugging + UI context)
 */
export type AudioReason =
  | "QUESTION_SNIPPET"   // Auto-play fragment when question starts
  | "HOST_PREVIEW"       // Host manually previewing full track
  | "AUDIOBAR"           // Host using AudioBar controls
  | "MINIGAME"           // Minigame audio
  | "UNKNOWN";

/**
 * Last played track info — allows resume/restart even when no question is active
 */
export interface LastPlayable {
  trackUri: string;
  trackId: string | null;
  trackName: string | null;
  artistName: string | null;
  albumArt: string | null;
  positionMs: number;
  durationMs: number | null;
  reason: AudioReason;
}

/**
 * Audio target state stored in Redis (server source of truth)
 */
export interface AudioTargetState {
  kind: AudioTargetKind;
  clientId: string | null;       // WebSocket socket.id of the target client
  deviceId: string | null;       // Spotify Connect device_id
  deviceName: string | null;     // Human-readable device name
  lastHeartbeat: number;         // Timestamp of last heartbeat
  version: number;               // Incremented on every change
  status: AudioPlaybackStatus;
  currentTrackUri: string | null;
  currentPositionMs: number;
  lastPlayable: LastPlayable | null; // For resume/restart
}

/**
 * Default (empty) audio target state
 */
export function createDefaultAudioTargetState(): AudioTargetState {
  return {
    kind: AudioTargetKind.NONE,
    clientId: null,
    deviceId: null,
    deviceName: null,
    lastHeartbeat: 0,
    version: 0,
    status: AudioPlaybackStatus.STOPPED,
    currentTrackUri: null,
    currentPositionMs: 0,
    lastPlayable: null,
  };
}

// ============================================================================
// CLIENT → SERVER COMMANDS (Zod schemas)
// ============================================================================

/**
 * Client registers its Spotify SDK player device
 * Sent after SDK 'ready' event fires with device_id
 */
export const registerAudioPlayerSchema = z.object({
  sessionCode: z.string(),
  deviceId: z.string(),
  deviceName: z.string().optional().default("PartyQuiz Player"),
  kind: z.nativeEnum(AudioTargetKind),
});
export type RegisterAudioPlayerCommand = z.infer<typeof registerAudioPlayerSchema>;

/**
 * Client sends heartbeat to confirm SDK device is still alive
 */
export const audioHeartbeatSchema = z.object({
  sessionCode: z.string(),
  deviceId: z.string(),
});
export type AudioHeartbeatCommand = z.infer<typeof audioHeartbeatSchema>;

/**
 * Host sets which client should be the audio target
 */
export const setAudioTargetSchema = z.object({
  sessionCode: z.string(),
  kind: z.nativeEnum(AudioTargetKind),
  deviceId: z.string().optional(),
  force: z.boolean().optional().default(false), // Force takeover
});
export type SetAudioTargetCommand = z.infer<typeof setAudioTargetSchema>;

/**
 * Host sends an audio command (play/pause/seek/volume/stop/restartLast)
 */
export const audioCommandSchema = z.object({
  sessionCode: z.string(),
  action: z.enum(["play", "pause", "resume", "seek", "volume", "stop", "restartLast"]),
  // Play-specific params
  trackUri: z.string().optional(),     // spotify:track:xxx
  trackId: z.string().optional(),      // Just the ID (we'll build URI)
  positionMs: z.number().optional(),   // Start position or seek target
  durationMs: z.number().optional(),   // Auto-pause after this duration
  // Volume param (0..1, NOT 0..100!)
  volume: z.number().min(0).max(1).optional(),
  // Track metadata (for lastPlayable tracking)
  trackName: z.string().optional(),
  artistName: z.string().optional(),
  albumArt: z.string().optional(),
  // Why is this command being sent (debugging + UI context)
  reason: z.enum(["QUESTION_SNIPPET", "HOST_PREVIEW", "AUDIOBAR", "MINIGAME", "UNKNOWN"]).optional().default("UNKNOWN"),
});
export type AudioCommand = z.infer<typeof audioCommandSchema>;

// ============================================================================
// SERVER → CLIENT EVENTS (Zod schemas)
// ============================================================================

/**
 * Audio target changed (broadcast to all clients in session)
 */
export const audioTargetChangedSchema = z.object({
  kind: z.nativeEnum(AudioTargetKind),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  version: z.number(),
  status: z.nativeEnum(AudioPlaybackStatus),
});
export type AudioTargetChangedEvent = z.infer<typeof audioTargetChangedSchema>;

/**
 * Audio status update (sent to host + observers for UI updates)
 * 
 * NOTE: Use `isPlaying` (not `playing`) — consistent with client-side naming.
 */
export const audioStatusSchema = z.object({
  isPlaying: z.boolean(),
  trackUri: z.string().nullable(),
  trackId: z.string().nullable(),
  trackName: z.string().nullable().optional(),
  artistName: z.string().nullable().optional(),
  albumArt: z.string().nullable().optional(),
  positionMs: z.number(),
  durationMs: z.number().optional(),
  deviceName: z.string().nullable(),
  status: z.nativeEnum(AudioPlaybackStatus),
  volume: z.number().optional(),
  reason: z.string().optional(),
});
export type AudioStatusEvent = z.infer<typeof audioStatusSchema>;

/**
 * Audio error event (sent to host)
 */
export const audioErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  needsActivation: z.boolean().optional().default(false),
});
export type AudioErrorEvent = z.infer<typeof audioErrorSchema>;

// ============================================================================
// SDK EXECUTOR SYSTEM — "SDK is executor, server is conductor"
// ============================================================================

/**
 * State machine for SDK client (SpotifyAudioTarget)
 *
 * DISCONNECTED → SDK_READY → ACTIVATED → IDLE
 *     ↑              ↑                     ↕
 *   not_ready    autoplay_failed    EXECUTING → PLAYING / PAUSED
 *     ↑                                ↕
 *   error / tab suspend            ERROR_RECOVERY
 */
export enum AudioSDKState {
  DISCONNECTED = "DISCONNECTED",
  SDK_READY = "SDK_READY",       // SDK connected, device_id obtained
  ACTIVATED = "ACTIVATED",       // activateElement() called (needed for autoplay)
  IDLE = "IDLE",                 // Ready to receive commands
  EXECUTING = "EXECUTING",       // Processing a command
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  ERROR_RECOVERY = "ERROR_RECOVERY",
}

/**
 * Server → SDK Client: execute a playback command locally via SDK
 * (replaces the old approach of server calling Spotify Web API)
 */
export const audioExecuteCommandSchema = z.object({
  commandId: z.string(),          // Unique ID for ACK tracking
  seq: z.number(),                // Sequence number for ordering
  action: z.enum(["play", "pause", "resume", "seek", "volume", "stop"]),
  // Play params
  trackUri: z.string().optional(),
  positionMs: z.number().optional(),
  durationMs: z.number().optional(),   // Auto-pause after this duration
  // Volume param
  volume: z.number().min(0).max(1).optional(),
  // Metadata (for UI)
  trackName: z.string().optional(),
  artistName: z.string().optional(),
  albumArt: z.string().optional(),
  reason: z.string().optional(),
});
export type AudioExecuteCommand = z.infer<typeof audioExecuteCommandSchema>;

/**
 * SDK Client → Server: acknowledge command execution
 */
export const audioAckSchema = z.object({
  commandId: z.string(),
  sessionCode: z.string(),
  status: z.enum(["ok", "fail"]),
  error: z.string().optional(),
  // Current state after execution
  sdkState: z.nativeEnum(AudioSDKState).optional(),
  isPlaying: z.boolean().optional(),
  positionMs: z.number().optional(),
  durationMs: z.number().optional(),
  trackUri: z.string().optional(),
});
export type AudioAckEvent = z.infer<typeof audioAckSchema>;

/**
 * SDK Client → Server: report state machine transition
 */
export const audioSDKStateChangeSchema = z.object({
  sessionCode: z.string(),
  state: z.nativeEnum(AudioSDKState),
  deviceId: z.string().optional(),
  error: z.string().optional(),
});
export type AudioSDKStateChangeEvent = z.infer<typeof audioSDKStateChangeSchema>;

// ============================================================================
// WS EVENT NAMES
// ============================================================================

/**
 * All audio-related WebSocket event names
 */
export enum AudioWSEvent {
  // Client → Server
  REGISTER_AUDIO_PLAYER = "REGISTER_AUDIO_PLAYER",
  UNREGISTER_AUDIO_PLAYER = "UNREGISTER_AUDIO_PLAYER",
  AUDIO_HEARTBEAT = "AUDIO_HEARTBEAT",
  SET_AUDIO_TARGET = "SET_AUDIO_TARGET",
  AUDIO_COMMAND = "AUDIO_COMMAND",      // Host → Server: intent (play/pause/etc)
  GET_AUDIO_TARGET = "GET_AUDIO_TARGET",
  AUDIO_ACK = "AUDIO_ACK",             // SDK Client → Server: command acknowledged
  AUDIO_SDK_STATE_CHANGE = "AUDIO_SDK_STATE_CHANGE", // SDK Client → Server

  // Server → Client (broadcast to session)
  AUDIO_TARGET_CHANGED = "AUDIO_TARGET_CHANGED",
  AUDIO_STATUS = "AUDIO_STATUS",
  AUDIO_ERROR = "AUDIO_ERROR",
  
  // Server → Specific SDK client (audio target)
  AUDIO_EXECUTE_COMMAND = "AUDIO_EXECUTE_COMMAND", // Execute via SDK locally
  // Legacy (kept for backwards compat, will be removed)
  AUDIO_PLAY_TRACK = "AUDIO_PLAY_TRACK",
  AUDIO_PAUSE = "AUDIO_PAUSE",
  AUDIO_SEEK = "AUDIO_SEEK",
  AUDIO_SET_VOLUME = "AUDIO_SET_VOLUME",
}
