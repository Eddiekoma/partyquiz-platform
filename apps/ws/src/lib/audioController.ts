/**
 * Server-side Audio Controller — "SDK is executor, server is conductor"
 * 
 * Architecture (based on Spotify SDK best practices):
 * - Server is the SOURCE OF TRUTH for routing + intent
 * - SDK client (SpotifyAudioTarget) EXECUTES playback locally via SDK
 * - Server NEVER calls Spotify Web API for play/pause/seek/volume on SDK devices
 *   (this causes 404 "Device not found" because SDK device_id propagation is delayed)
 * - Server sends AUDIO_EXECUTE_COMMAND → SDK client executes → sends AUDIO_ACK back
 * - Web API is ONLY used for: metadata/search + external Spotify Connect devices
 *
 * Key responsibilities:
 * 1. Audio Target management (which device plays audio)
 * 2. Command queue (serializes commands per session, ACK-driven)
 * 3. Dispatch commands to SDK client via WebSocket
 * 4. ACK-based retry (max 2-3 retries with 1.5s timeout)
 * 5. Auto-pause after duration (for quiz question snippets)
 * 6. Fallback to Web API ONLY for CONNECT_DEVICE targets
 */

import { Server } from "socket.io";
import { pino } from "pino";
import { redis } from "@partyquiz/shared/server";
import {
  AudioTargetKind,
  AudioPlaybackStatus,
  AudioWSEvent,
  AudioSDKState,
  type AudioTargetState,
  type AudioCommand,
  type LastPlayable,
  type AudioAckEvent,
  createDefaultAudioTargetState,
} from "@partyquiz/shared";
import { getSpotifyTokenForSession } from "./spotifyToken";
import { randomUUID } from "crypto";

const logger = pino({ name: "audio-controller" });

// Per-session command queue: ensures serialized execution
const commandQueues = new Map<string, Promise<void>>();

// Per-session auto-pause timers
const autoPauseTimers = new Map<string, NodeJS.Timeout>();

// Per-session command sequence counter
const commandSeqs = new Map<string, number>();

// Pending ACKs: commandId → { resolve, reject, timer, sessionCode }
const pendingAcks = new Map<string, {
  resolve: (ack: AudioAckEvent) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  sessionCode: string;
}>();

/** ACK timeout (ms) — client may need to transfer + retry once (~5s) */
const ACK_TIMEOUT = 30_000;
/** Max retries for a command (server-side, after ACK timeout) */
const MAX_RETRIES = 1;

/**
 * Clear all pending ACKs and reset command queue for a session.
 * Called on takeover/unregister so stale commands don't block new ones.
 */
function clearSessionCommands(sessionCode: string): void {
  // Cancel all pending ACKs for this session
  for (const [cmdId, pending] of pendingAcks.entries()) {
    if (pending.sessionCode === sessionCode) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Session commands cleared (takeover/unregister)"));
      pendingAcks.delete(cmdId);
    }
  }
  // Reset the command queue so new commands aren't blocked
  commandQueues.delete(sessionCode);
  // Reset seq counter
  commandSeqs.delete(sessionCode);
  logger.info({ sessionCode }, "Cleared pending commands and queue for session");
}

// ============================================================================
// AUDIO TARGET STATE (Redis)
// ============================================================================

const AUDIO_TARGET_KEY = (code: string) => `session:${code}:audioTarget`;
const AUDIO_TARGET_TTL = 86400; // 24 hours

/**
 * Get audio target state for a session
 */
export async function getAudioTarget(sessionCode: string): Promise<AudioTargetState> {
  try {
    const raw = await redis.get(AUDIO_TARGET_KEY(sessionCode));
    if (!raw) return createDefaultAudioTargetState();
    return JSON.parse(raw) as AudioTargetState;
  } catch {
    return createDefaultAudioTargetState();
  }
}

/**
 * Set audio target state (Redis + broadcast to clients)
 */
async function setAudioTarget(
  sessionCode: string,
  state: AudioTargetState,
  io: Server
): Promise<void> {
  await redis.set(AUDIO_TARGET_KEY(sessionCode), JSON.stringify(state), "EX", AUDIO_TARGET_TTL);

  // Broadcast to all clients in the session
  io.to(sessionCode).emit(AudioWSEvent.AUDIO_TARGET_CHANGED, {
    kind: state.kind,
    deviceId: state.deviceId,
    deviceName: state.deviceName,
    version: state.version,
    status: state.status,
  });
}

// ============================================================================
// REGISTRATION & TARGET MANAGEMENT
// ============================================================================

/**
 * Register a Spotify SDK player (called when SDK 'ready' fires on a client)
 */
export async function registerAudioPlayer(
  sessionCode: string,
  clientId: string,
  deviceId: string,
  deviceName: string,
  kind: AudioTargetKind,
  io: Server
): Promise<{ success: boolean; message: string }> {
  const current = await getAudioTarget(sessionCode);

  // If there's already an active target with a different client, reject
  // UNLESS it's the same kind (e.g. HOST re-registering after page refresh)
  if (
    current.kind !== AudioTargetKind.NONE &&
    current.clientId &&
    current.clientId !== clientId
  ) {
    // Same kind (e.g. HOST → HOST): allow takeover — this is almost certainly
    // a page refresh / new tab on the same machine.
    if (current.kind === kind) {
      logger.info(
        { sessionCode, oldClient: current.clientId, newClient: clientId, kind },
        "Same-kind takeover (likely page refresh) — allowing re-registration"
      );
      // Clear any pending commands for the old client — they'll never ACK
      clearSessionCommands(sessionCode);
    } else {
      // Different kind: check if the existing client is still alive
      const isAlive = Date.now() - current.lastHeartbeat < 15000;
      if (isAlive) {
        logger.info(
          { sessionCode, existingClient: current.clientId, newClient: clientId },
          "Rejecting audio player registration - another device is active"
        );
        return {
          success: false,
          message: "Another device is already the audio target. Use 'Take Over' to switch.",
        };
      }
      // Existing client is dead, allow takeover
      logger.info(
        { sessionCode, deadClient: current.clientId, newClient: clientId },
        "Taking over from dead audio target"
      );
    }
  }

  const newState: AudioTargetState = {
    kind,
    clientId,
    deviceId,
    deviceName,
    lastHeartbeat: Date.now(),
    version: current.version + 1,
    status: AudioPlaybackStatus.STOPPED,
    currentTrackUri: null,
    currentPositionMs: 0,
    lastPlayable: null,
  };

  await setAudioTarget(sessionCode, newState, io);
  logger.info({ sessionCode, deviceId, kind, clientId }, "Audio player registered");
  return { success: true, message: "Audio player registered" };
}

/**
 * Unregister audio player (client disconnects or SDK fails)
 */
export async function unregisterAudioPlayer(
  sessionCode: string,
  clientId: string,
  io: Server
): Promise<void> {
  const current = await getAudioTarget(sessionCode);
  if (current.clientId !== clientId) return; // Not the active target

  // Clear any pending commands — this client is gone
  clearSessionCommands(sessionCode);

  const newState = createDefaultAudioTargetState();
  newState.version = current.version + 1;
  await setAudioTarget(sessionCode, newState, io);
  
  // Clear any auto-pause timer
  clearAutoPauseTimer(sessionCode);
  
  logger.info({ sessionCode, clientId }, "Audio player unregistered");
}

/**
 * Update heartbeat for audio target
 */
export async function updateAudioHeartbeat(
  sessionCode: string,
  clientId: string
): Promise<void> {
  const current = await getAudioTarget(sessionCode);
  if (current.clientId !== clientId) return;

  current.lastHeartbeat = Date.now();
  await redis.set(AUDIO_TARGET_KEY(sessionCode), JSON.stringify(current), "EX", AUDIO_TARGET_TTL);
}

/**
 * Host sets audio target (switch between HOST/DISPLAY/CONNECT_DEVICE)
 */
export async function setAudioTargetKind(
  sessionCode: string,
  kind: AudioTargetKind,
  deviceId: string | undefined,
  force: boolean,
  io: Server
): Promise<{ success: boolean; message: string }> {
  const current = await getAudioTarget(sessionCode);

  if (kind === AudioTargetKind.NONE) {
    // Disable audio
    const newState = createDefaultAudioTargetState();
    newState.version = current.version + 1;
    await setAudioTarget(sessionCode, newState, io);
    clearAutoPauseTimer(sessionCode);
    return { success: true, message: "Audio disabled" };
  }

  if (kind === AudioTargetKind.CONNECT_DEVICE && deviceId) {
    // Set to external Spotify Connect device
    const newState: AudioTargetState = {
      kind,
      clientId: null,
      deviceId,
      deviceName: "Spotify Connect Device",
      lastHeartbeat: Date.now(),
      version: current.version + 1,
      status: AudioPlaybackStatus.STOPPED,
      currentTrackUri: null,
      currentPositionMs: 0,
      lastPlayable: null,
    };
    await setAudioTarget(sessionCode, newState, io);
    return { success: true, message: `Audio target set to Connect device ${deviceId}` };
  }

  // For HOST/DISPLAY: the actual device registration happens when the client
  // calls REGISTER_AUDIO_PLAYER. Here we just signal intent.
  // If force=true, we clear the current target to allow new registration.
  if (force || current.kind === AudioTargetKind.NONE || current.kind !== kind) {
    const newState: AudioTargetState = {
      kind,
      clientId: null, // Will be set by REGISTER_AUDIO_PLAYER
      deviceId: null,
      deviceName: null,
      lastHeartbeat: Date.now(),
      version: current.version + 1,
      status: AudioPlaybackStatus.STOPPED,
      currentTrackUri: null,
      currentPositionMs: 0,
      lastPlayable: null,
    };
    await setAudioTarget(sessionCode, newState, io);
    return { success: true, message: `Audio target set to ${kind} - waiting for player registration` };
  }

  return { success: true, message: `Audio target already set to ${kind}` };
}

// ============================================================================
// COMMAND QUEUE (serialize commands per session)
// ============================================================================

/**
 * Enqueue a command for execution. Commands are serialized per session.
 * If a NEW play/stop command arrives while a previous command is still pending,
 * the old pending ACKs are cancelled so the new command runs immediately.
 */
async function enqueueCommand(
  sessionCode: string,
  action: string,
  fn: () => Promise<void>
): Promise<void> {
  // If there's already a pending command and this is a new play/stop,
  // cancel the old one so we don't wait 30+ seconds for it to fail.
  if (commandQueues.has(sessionCode) && (action === "play" || action === "stop")) {
    clearSessionCommands(sessionCode);
  }

  const prev = commandQueues.get(sessionCode) || Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    // Only log if it's NOT a cancellation (which is expected)
    if (!err?.message?.includes("Session commands cleared")) {
      logger.error({ err, sessionCode, action }, "Audio command failed");
    }
  });
  commandQueues.set(sessionCode, next);
  await next;
}

// ============================================================================
// ACK SYSTEM — wait for SDK client to confirm command execution
// ============================================================================

function getNextSeq(sessionCode: string): number {
  const current = commandSeqs.get(sessionCode) || 0;
  const next = current + 1;
  commandSeqs.set(sessionCode, next);
  return next;
}

/**
 * Send a command to the SDK client and wait for ACK.
 * Returns the ACK event, or throws on timeout/failure.
 */
function sendCommandToSDKClient(
  io: Server,
  targetClientId: string,
  sessionCode: string,
  command: {
    action: string;
    trackUri?: string;
    positionMs?: number;
    durationMs?: number;
    volume?: number;
    trackName?: string;
    artistName?: string;
    albumArt?: string;
    reason?: string;
  },
  retriesLeft = MAX_RETRIES
): Promise<AudioAckEvent> {
  return new Promise<AudioAckEvent>((resolve, reject) => {
    const commandId = randomUUID();
    const seq = getNextSeq(sessionCode);

    const executeCommand = {
      commandId,
      seq,
      action: command.action,
      trackUri: command.trackUri,
      positionMs: command.positionMs,
      durationMs: command.durationMs,
      volume: command.volume,
      trackName: command.trackName,
      artistName: command.artistName,
      albumArt: command.albumArt,
      reason: command.reason,
    };

    // Set up ACK timeout
    const timer = setTimeout(() => {
      pendingAcks.delete(commandId);
      if (retriesLeft > 0) {
        logger.warn(
          { sessionCode, commandId, action: command.action, retriesLeft },
          "No ACK received, retrying command"
        );
        // Retry
        sendCommandToSDKClient(io, targetClientId, sessionCode, command, retriesLeft - 1)
          .then(resolve)
          .catch(reject);
      } else {
        logger.error(
          { sessionCode, commandId, action: command.action },
          "Command failed: no ACK after all retries"
        );
        reject(new Error(`No ACK for ${command.action} after ${MAX_RETRIES + 1} attempts`));
      }
    }, ACK_TIMEOUT);

    // Register pending ACK
    pendingAcks.set(commandId, { resolve, reject, timer, sessionCode });

    // Send command to the specific SDK client socket
    logger.info(
      { sessionCode, commandId, seq, action: command.action, targetClientId },
      "Sending AUDIO_EXECUTE_COMMAND to SDK client"
    );
    io.to(targetClientId).emit(AudioWSEvent.AUDIO_EXECUTE_COMMAND, executeCommand);
  });
}

/**
 * Handle incoming ACK from SDK client.
 * Called from the WS handler in index.ts.
 */
export function handleAudioAck(ack: AudioAckEvent): void {
  const pending = pendingAcks.get(ack.commandId);
  if (!pending) {
    // ACK for a command we already timed out on — ignore
    logger.debug({ commandId: ack.commandId }, "Received ACK for unknown/expired command");
    return;
  }

  clearTimeout(pending.timer);
  pendingAcks.delete(ack.commandId);

  if (ack.status === "ok") {
    pending.resolve(ack);
  } else {
    logger.warn(
      { commandId: ack.commandId, error: ack.error },
      "SDK client reported command failure"
    );
    pending.reject(new Error(ack.error || "SDK command failed"));
  }
}

// ============================================================================
// SPOTIFY WEB API HELPERS (ONLY for CONNECT_DEVICE targets, NOT for SDK devices)
// ============================================================================

async function spotifyFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://api.spotify.com/v1${endpoint}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (res.status === 204) {
      return { ok: true, status: 204 };
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      logger.warn({ endpoint, status: res.status, error: errorText }, "Spotify API error");
      return { ok: false, status: res.status, error: errorText };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    logger.error({ err, endpoint }, "Spotify fetch error");
    return { ok: false, status: 0, error: err.message };
  }
}

/**
 * Start/resume playback on a Spotify Connect device via Web API
 * (ONLY used for CONNECT_DEVICE targets, never for SDK devices!)
 */
async function webApiPlayTrack(
  token: string,
  deviceId: string,
  trackUri?: string,
  positionMs?: number
): Promise<boolean> {
  const url = `/me/player/play?device_id=${encodeURIComponent(deviceId)}`;
  const body: any = {};
  if (trackUri) body.uris = [trackUri];
  if (positionMs !== undefined && positionMs > 0) body.position_ms = positionMs;

  const result = await spotifyFetch(token, url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return result.ok || result.status === 204;
}

/**
 * Pause playback via Web API (ONLY for CONNECT_DEVICE)
 */
async function webApiPause(token: string, deviceId?: string): Promise<boolean> {
  const url = deviceId
    ? `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/pause";
  const result = await spotifyFetch(token, url, { method: "PUT" });
  return result.ok || result.status === 204 || result.status === 403;
}

/**
 * Set volume via Web API (ONLY for CONNECT_DEVICE)
 */
async function webApiSetVolume(token: string, volumePercent: number, deviceId?: string): Promise<boolean> {
  let url = `/me/player/volume?volume_percent=${Math.round(volumePercent)}`;
  if (deviceId) url += `&device_id=${encodeURIComponent(deviceId)}`;
  const result = await spotifyFetch(token, url, { method: "PUT" });
  return result.ok || result.status === 204;
}

// ============================================================================
// AUTO-PAUSE TIMER
// ============================================================================

function clearAutoPauseTimer(sessionCode: string): void {
  const timer = autoPauseTimers.get(sessionCode);
  if (timer) {
    clearTimeout(timer);
    autoPauseTimers.delete(sessionCode);
  }
}

function setAutoPauseTimer(
  sessionCode: string,
  durationMs: number,
  io: Server
): void {
  clearAutoPauseTimer(sessionCode);

  const timer = setTimeout(async () => {
    autoPauseTimers.delete(sessionCode);
    logger.info({ sessionCode, durationMs }, "Auto-pause timer fired");
    await executeAudioCommand(sessionCode, { 
      sessionCode,
      action: "pause",
      reason: "QUESTION_SNIPPET",
    }, io);
  }, durationMs);

  autoPauseTimers.set(sessionCode, timer);
}

// ============================================================================
// MAIN COMMAND EXECUTOR — "SDK is executor, server is conductor"
// ============================================================================

/**
 * Execute an audio command (the public API for the WS handlers).
 * 
 * For SDK devices (HOST/DISPLAY):
 *   → Send AUDIO_EXECUTE_COMMAND to the SDK client via WebSocket
 *   → SDK client executes locally (play/pause/seek/volume via SDK methods)
 *   → SDK client sends AUDIO_ACK back
 *   → Server updates state + broadcasts AUDIO_STATUS
 * 
 * For CONNECT_DEVICE targets:
 *   → Server calls Spotify Web API directly (legacy path)
 *
 * All commands are queued per session.
 */
export async function executeAudioCommand(
  sessionCode: string,
  command: AudioCommand,
  io: Server
): Promise<void> {
  await enqueueCommand(sessionCode, command.action, async () => {
    const target = await getAudioTarget(sessionCode);

    // Validate we have an active target
    if (target.kind === AudioTargetKind.NONE) {
      logger.warn({ sessionCode, action: command.action }, "No active audio target");
      io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
        code: "NO_AUDIO_TARGET",
        message: "Geen actieve afspeellocatie. Activeer audio op het display of host-scherm.",
        needsActivation: true,
      });
      return;
    }

    const reason = command.reason ?? "UNKNOWN";
    const isSDKTarget = target.kind === AudioTargetKind.HOST || target.kind === AudioTargetKind.DISPLAY;

    // For SDK targets, we need a connected client
    if (isSDKTarget && !target.clientId) {
      logger.warn({ sessionCode, action: command.action, kind: target.kind }, "SDK target has no connected client");
      io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
        code: "NO_SDK_CLIENT",
        message: "Audio device is nog niet verbonden. Wacht tot de Spotify SDK is geladen.",
        needsActivation: true,
      });
      return;
    }

    // For CONNECT_DEVICE, we need a deviceId and token
    if (target.kind === AudioTargetKind.CONNECT_DEVICE) {
      if (!target.deviceId) {
        io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
          code: "NO_DEVICE",
          message: "Geen Spotify Connect device geselecteerd.",
          needsActivation: false,
        });
        return;
      }
      await executeConnectDeviceCommand(sessionCode, command, target, io);
      return;
    }

    // ================================================================
    // SDK TARGET PATH — Send command to SDK client for local execution
    // ================================================================

    /**
     * Helper: broadcast consistent AUDIO_STATUS to all clients
     */
    const broadcastStatus = (
      isPlaying: boolean,
      overrides: Partial<{
        trackUri: string | null;
        trackId: string | null;
        trackName: string | null;
        artistName: string | null;
        albumArt: string | null;
        positionMs: number;
        durationMs: number;
        status: AudioPlaybackStatus;
        reason: string;
      }> = {}
    ) => {
      io.to(sessionCode).emit(AudioWSEvent.AUDIO_STATUS, {
        isPlaying,
        trackUri: overrides.trackUri ?? target.currentTrackUri,
        trackId: overrides.trackId ?? target.lastPlayable?.trackId ?? null,
        trackName: overrides.trackName ?? target.lastPlayable?.trackName ?? null,
        artistName: overrides.artistName ?? target.lastPlayable?.artistName ?? null,
        albumArt: overrides.albumArt ?? target.lastPlayable?.albumArt ?? null,
        positionMs: overrides.positionMs ?? target.currentPositionMs,
        durationMs: overrides.durationMs ?? target.lastPlayable?.durationMs,
        deviceName: target.deviceName,
        status: overrides.status ?? (isPlaying ? AudioPlaybackStatus.PLAYING : AudioPlaybackStatus.PAUSED),
        reason: overrides.reason ?? reason,
      });
    };

    /**
     * Helper: persist target state to Redis
     */
    const persistTarget = async () => {
      await redis.set(AUDIO_TARGET_KEY(sessionCode), JSON.stringify(target), "EX", AUDIO_TARGET_TTL);
    };

    try {
      switch (command.action) {
        case "play": {
          const trackUri = command.trackUri ||
            (command.trackId ? `spotify:track:${command.trackId}` : undefined);

          if (!trackUri) {
            io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
              code: "NO_TRACK",
              message: "Geen track opgegeven om af te spelen.",
              needsActivation: false,
            });
            return;
          }

          // Send play command to SDK client
          const ack = await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
            action: "play",
            trackUri,
            positionMs: command.positionMs,
            durationMs: command.durationMs,
            volume: command.volume,
            trackName: command.trackName,
            artistName: command.artistName,
            albumArt: command.albumArt,
            reason,
          });

          // SDK client confirmed play — set auto-pause timer on server
          // (more reliable than client-side timer since server is always-on)
          if (command.durationMs && command.durationMs > 0) {
            setAutoPauseTimer(sessionCode, command.durationMs, io);
          }

          // Save lastPlayable for resume/restart
          target.lastPlayable = {
            trackUri,
            trackId: command.trackId || null,
            trackName: command.trackName || null,
            artistName: command.artistName || null,
            albumArt: command.albumArt || null,
            positionMs: command.positionMs || 0,
            durationMs: command.durationMs || null,
            reason,
          };
          target.status = AudioPlaybackStatus.PLAYING;
          target.currentTrackUri = trackUri;
          target.currentPositionMs = ack.positionMs ?? command.positionMs ?? 0;
          await persistTarget();

          broadcastStatus(true, {
            trackUri,
            trackId: command.trackId ?? null,
            trackName: command.trackName ?? null,
            artistName: command.artistName ?? null,
            albumArt: command.albumArt ?? null,
            positionMs: command.positionMs ?? 0,
            durationMs: command.durationMs,
            status: AudioPlaybackStatus.PLAYING,
            reason,
          });

          logger.info(
            { sessionCode, trackUri, positionMs: command.positionMs, durationMs: command.durationMs, reason },
            "Audio playback started (via SDK)"
          );
          break;
        }

        case "pause": {
          await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
            action: "pause",
            reason,
          });

          clearAutoPauseTimer(sessionCode);
          target.status = AudioPlaybackStatus.PAUSED;
          await persistTarget();

          broadcastStatus(false, { status: AudioPlaybackStatus.PAUSED });
          logger.info({ sessionCode }, "Audio paused (via SDK)");
          break;
        }

        case "resume": {
          // If we have a lastPlayable, send that info so SDK can resume properly
          const resumeParams: Record<string, unknown> = { action: "resume", reason };
          if (target.lastPlayable) {
            resumeParams.trackUri = target.lastPlayable.trackUri;
            resumeParams.positionMs = target.currentPositionMs;
          }

          await sendCommandToSDKClient(io, target.clientId!, sessionCode, resumeParams as any);

          target.status = AudioPlaybackStatus.PLAYING;
          await persistTarget();

          broadcastStatus(true, { status: AudioPlaybackStatus.PLAYING });
          logger.info({ sessionCode }, "Audio resumed (via SDK)");
          break;
        }

        case "restartLast": {
          if (!target.lastPlayable) {
            io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
              code: "NO_LAST_TRACK",
              message: "Geen eerder afgespeeld nummer om te herstarten.",
              needsActivation: false,
            });
            return;
          }

          const lp = target.lastPlayable;

          await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
            action: "play",
            trackUri: lp.trackUri,
            positionMs: lp.positionMs,
            durationMs: lp.durationMs ?? undefined,
            trackName: lp.trackName ?? undefined,
            artistName: lp.artistName ?? undefined,
            albumArt: lp.albumArt ?? undefined,
            reason: lp.reason,
          });

          if (lp.durationMs && lp.durationMs > 0) {
            setAutoPauseTimer(sessionCode, lp.durationMs, io);
          }

          target.status = AudioPlaybackStatus.PLAYING;
          target.currentTrackUri = lp.trackUri;
          target.currentPositionMs = lp.positionMs;
          await persistTarget();

          broadcastStatus(true, {
            trackUri: lp.trackUri,
            trackId: lp.trackId,
            trackName: lp.trackName,
            artistName: lp.artistName,
            albumArt: lp.albumArt,
            positionMs: lp.positionMs,
            durationMs: lp.durationMs ?? undefined,
            status: AudioPlaybackStatus.PLAYING,
            reason: lp.reason,
          });

          logger.info({ sessionCode, trackUri: lp.trackUri, reason: lp.reason }, "Audio restarted (via SDK)");
          break;
        }

        case "seek": {
          if (command.positionMs !== undefined) {
            await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
              action: "seek",
              positionMs: command.positionMs,
              reason,
            });
            target.currentPositionMs = command.positionMs;
            await persistTarget();
          }
          break;
        }

        case "volume": {
          if (command.volume !== undefined) {
            await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
              action: "volume",
              volume: command.volume,
              reason,
            });
            logger.info({ sessionCode, volume: command.volume }, "Volume set (via SDK)");
          }
          break;
        }

        case "stop": {
          await sendCommandToSDKClient(io, target.clientId!, sessionCode, {
            action: "stop",
            reason,
          });

          clearAutoPauseTimer(sessionCode);
          target.status = AudioPlaybackStatus.STOPPED;
          target.currentTrackUri = null;
          target.currentPositionMs = 0;
          await persistTarget();

          broadcastStatus(false, {
            trackUri: null,
            trackId: null,
            positionMs: 0,
            status: AudioPlaybackStatus.STOPPED,
          });

          logger.info({ sessionCode }, "Audio stopped (via SDK)");
          break;
        }
      }
    } catch (err: any) {
      // "Session commands cleared" is expected during takeover/reconnection — not a user error
      if (err?.message?.includes("Session commands cleared")) {
        logger.debug({ sessionCode, action: command.action }, "Command cancelled (session takeover/reconnect)");
        return;
      }
      logger.error({ err, sessionCode, action: command.action }, "Audio command execution error");
      io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
        code: "COMMAND_FAILED",
        message: `Audio commando mislukt: ${err.message}`,
        needsActivation: false,
      });
    }
  });
}

// ============================================================================
// CONNECT_DEVICE FALLBACK (Web API calls for external Spotify devices)
// ============================================================================

/**
 * Execute commands for CONNECT_DEVICE targets via Spotify Web API.
 * This is the ONLY path that calls Spotify's REST endpoints for playback.
 */
async function executeConnectDeviceCommand(
  sessionCode: string,
  command: AudioCommand,
  target: AudioTargetState,
  io: Server
): Promise<void> {
  const token = await getSpotifyTokenForSession(sessionCode);
  if (!token) {
    io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
      code: "NO_SPOTIFY_TOKEN",
      message: "Spotify niet gekoppeld. Koppel Spotify in je accountinstellingen.",
      needsActivation: false,
    });
    return;
  }

  const deviceId = target.deviceId!;
  const reason = command.reason ?? "UNKNOWN";

  const persistTarget = async () => {
    await redis.set(AUDIO_TARGET_KEY(sessionCode), JSON.stringify(target), "EX", AUDIO_TARGET_TTL);
  };

  try {
    switch (command.action) {
      case "play": {
        const trackUri = command.trackUri ||
          (command.trackId ? `spotify:track:${command.trackId}` : undefined);
        if (!trackUri) return;

        const played = await webApiPlayTrack(token, deviceId, trackUri, command.positionMs);
        if (!played) {
          io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
            code: "PLAY_FAILED",
            message: "Kon nummer niet afspelen op Spotify Connect device.",
            needsActivation: false,
          });
          return;
        }

        if (command.durationMs && command.durationMs > 0) {
          setAutoPauseTimer(sessionCode, command.durationMs, io);
        }

        target.lastPlayable = {
          trackUri,
          trackId: command.trackId || null,
          trackName: command.trackName || null,
          artistName: command.artistName || null,
          albumArt: command.albumArt || null,
          positionMs: command.positionMs || 0,
          durationMs: command.durationMs || null,
          reason,
        };
        target.status = AudioPlaybackStatus.PLAYING;
        target.currentTrackUri = trackUri;
        await persistTarget();
        break;
      }
      case "pause": {
        await webApiPause(token, deviceId);
        clearAutoPauseTimer(sessionCode);
        target.status = AudioPlaybackStatus.PAUSED;
        await persistTarget();
        break;
      }
      case "resume": {
        await webApiPlayTrack(token, deviceId);
        target.status = AudioPlaybackStatus.PLAYING;
        await persistTarget();
        break;
      }
      case "volume": {
        if (command.volume !== undefined) {
          await webApiSetVolume(token, Math.round(command.volume * 100), deviceId);
        }
        break;
      }
      case "stop": {
        await webApiPause(token, deviceId);
        clearAutoPauseTimer(sessionCode);
        target.status = AudioPlaybackStatus.STOPPED;
        await persistTarget();
        break;
      }
    }
  } catch (err: any) {
    logger.error({ err, sessionCode, action: command.action }, "Connect device command error");
    io.to(sessionCode).emit(AudioWSEvent.AUDIO_ERROR, {
      code: "COMMAND_FAILED",
      message: `Audio commando mislukt: ${err.message}`,
      needsActivation: false,
    });
  }
}

/**
 * Clean up all audio state for a session (called on session end/reset)
 */
export async function cleanupSessionAudio(sessionCode: string): Promise<void> {
  clearAutoPauseTimer(sessionCode);
  commandQueues.delete(sessionCode);
  commandSeqs.delete(sessionCode);
  // Clean up pending ACKs for this session
  for (const [cmdId, pending] of pendingAcks.entries()) {
    clearTimeout(pending.timer);
    pendingAcks.delete(cmdId);
  }
  await redis.del(AUDIO_TARGET_KEY(sessionCode));
  logger.info({ sessionCode }, "Session audio state cleaned up");
}
