/**
 * Client-Side Prediction Hook for Swan Chase
 *
 * Provides smooth rendering by:
 * 1. Local player: Instant client-side movement prediction with server reconciliation
 * 2. Remote players: Interpolation between server ticks at 60 FPS
 *
 * The hook sits between the WebSocket game state and the rendering layer.
 */

import { useRef, useCallback, useMemo } from "react";
import type { SwanChaseGameState, SwanChasePlayer, Vector2D, SwanChaseSettings } from "@partyquiz/shared";
import { SwanChasePlayerStatus } from "@partyquiz/shared";
import {
  applyMovement,
  resolveObstacleCollisions,
  lerpPosition,
  lerpAngle,
} from "@/lib/swan-chase/physics-client";

export interface PredictedPlayer {
  // Server-confirmed state
  serverPosition: Vector2D;
  serverVelocity: Vector2D;
  serverRotation: number;
  serverTimestamp: number;

  // Interpolation (remote players)
  previousPosition: Vector2D;
  targetPosition: Vector2D;
  previousRotation: number;
  targetRotation: number;
  interpolationT: number;

  // Predicted state (local player only)
  predictedPosition: Vector2D;
  predictedVelocity: Vector2D;

  // What gets rendered
  renderPosition: Vector2D;
  renderRotation: number;
  renderVelocity: Vector2D;

  // Original data pass-through
  data: SwanChasePlayer;
}

interface PendingInput {
  sequence: number;
  direction: Vector2D;
  speed: number;
  timestamp: number;
}

const SERVER_TICK_MS = 1000 / 30; // 30 FPS server
const CORRECTION_THRESHOLD = 5; // px difference before correcting
const CORRECTION_SMOOTHING = 0.15; // lerp factor per frame for corrections

export function useClientPrediction(localPlayerId: string) {
  const playersRef = useRef<Map<string, PredictedPlayer>>(new Map());
  const inputBufferRef = useRef<PendingInput[]>([]);
  const sequenceRef = useRef(0);
  const lastServerTickRef = useRef(0);
  const settingsRef = useRef<SwanChaseSettings | null>(null);

  /**
   * Called when a new server state arrives (30 FPS)
   */
  const onServerState = useCallback((state: SwanChaseGameState) => {
    const now = Date.now();
    settingsRef.current = state.settings;
    lastServerTickRef.current = now;
    const players = playersRef.current;

    for (const serverPlayer of state.players) {
      const existing = players.get(serverPlayer.id);
      const isLocal = serverPlayer.id === localPlayerId;

      if (!existing) {
        // New player - initialize
        players.set(serverPlayer.id, {
          serverPosition: { ...serverPlayer.position },
          serverVelocity: { ...serverPlayer.velocity },
          serverRotation: serverPlayer.rotation,
          serverTimestamp: now,
          previousPosition: { ...serverPlayer.position },
          targetPosition: { ...serverPlayer.position },
          previousRotation: serverPlayer.rotation,
          targetRotation: serverPlayer.rotation,
          interpolationT: 1,
          predictedPosition: { ...serverPlayer.position },
          predictedVelocity: { ...serverPlayer.velocity },
          renderPosition: { ...serverPlayer.position },
          renderRotation: serverPlayer.rotation,
          renderVelocity: { ...serverPlayer.velocity },
          data: serverPlayer,
        });
        continue;
      }

      // Update server state
      existing.serverPosition = { ...serverPlayer.position };
      existing.serverVelocity = { ...serverPlayer.velocity };
      existing.serverRotation = serverPlayer.rotation;
      existing.serverTimestamp = now;
      existing.data = serverPlayer;

      if (isLocal) {
        // Local player: server reconciliation
        const predicted = existing.predictedPosition;
        const serverPos = existing.serverPosition;
        const dx = predicted.x - serverPos.x;
        const dy = predicted.y - serverPos.y;
        const diff = Math.sqrt(dx * dx + dy * dy);

        if (diff > CORRECTION_THRESHOLD) {
          // Smoothly correct toward server position
          existing.predictedPosition = {
            x: predicted.x + (serverPos.x - predicted.x) * CORRECTION_SMOOTHING,
            y: predicted.y + (serverPos.y - predicted.y) * CORRECTION_SMOOTHING,
          };
        }
        // If difference is small, trust our prediction (feels snappy)

        // Clear old inputs that the server has processed
        inputBufferRef.current = inputBufferRef.current.filter(
          input => input.timestamp > now - SERVER_TICK_MS * 3
        );
      } else {
        // Remote player: setup interpolation between previous and new target
        existing.previousPosition = { ...existing.targetPosition };
        existing.previousRotation = existing.targetRotation;
        existing.targetPosition = { ...serverPlayer.position };
        existing.targetRotation = serverPlayer.rotation;
        existing.interpolationT = 0;
      }
    }

    // Remove players that are no longer in the state
    const serverIds = new Set(state.players.map(p => p.id));
    for (const [id] of players) {
      if (!serverIds.has(id)) {
        players.delete(id);
      }
    }
  }, [localPlayerId]);

  /**
   * Called when the local player sends input (20 Hz / 50ms)
   */
  const onLocalInput = useCallback((direction: Vector2D, speed: number) => {
    const settings = settingsRef.current;
    if (!settings) return;

    const localPlayer = playersRef.current.get(localPlayerId);
    if (!localPlayer) return;

    // Skip if player is inactive
    const status = localPlayer.data.status;
    if (
      status === SwanChasePlayerStatus.TAGGED ||
      status === SwanChasePlayerStatus.SAFE ||
      status === SwanChasePlayerStatus.ELIMINATED
    ) return;

    // Calculate velocity from input
    const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
    let velocity: Vector2D = { x: 0, y: 0 };

    if (magnitude > 0.1) {
      velocity = {
        x: (direction.x / magnitude) * speed,
        y: (direction.y / magnitude) * speed,
      };

      // Update predicted rotation
      localPlayer.predictedVelocity = velocity;
    } else {
      localPlayer.predictedVelocity = { x: 0, y: 0 };
    }

    // Apply prediction immediately
    const bounds = settings.gameArea;
    let newPos = applyMovement(localPlayer.predictedPosition, velocity, bounds);
    newPos = resolveObstacleCollisions(newPos, settings.obstacles);
    localPlayer.predictedPosition = newPos;

    // Store in input buffer
    sequenceRef.current++;
    inputBufferRef.current.push({
      sequence: sequenceRef.current,
      direction,
      speed,
      timestamp: Date.now(),
    });

    // Keep buffer manageable
    if (inputBufferRef.current.length > 30) {
      inputBufferRef.current = inputBufferRef.current.slice(-20);
    }
  }, [localPlayerId]);

  /**
   * Called every render frame (60 FPS) to update render positions
   */
  const updateRenderPositions = useCallback((dt: number) => {
    const players = playersRef.current;

    for (const [id, player] of players) {
      const isLocal = id === localPlayerId;

      if (isLocal) {
        // Local player: render at predicted position
        player.renderPosition = { ...player.predictedPosition };
        player.renderVelocity = { ...player.predictedVelocity };

        // Smooth rotation toward movement direction
        if (Math.abs(player.predictedVelocity.x) > 0.1 || Math.abs(player.predictedVelocity.y) > 0.1) {
          const targetRot = Math.atan2(player.predictedVelocity.y, player.predictedVelocity.x);
          player.renderRotation = lerpAngle(player.renderRotation, targetRot, 0.2);
        }
      } else {
        // Remote player: interpolate between server ticks
        player.interpolationT += dt / (SERVER_TICK_MS / 1000);

        player.renderPosition = lerpPosition(
          player.previousPosition,
          player.targetPosition,
          Math.min(player.interpolationT, 1.2) // Allow slight overshoot for smoothness
        );
        player.renderRotation = lerpAngle(
          player.previousRotation,
          player.targetRotation,
          Math.min(player.interpolationT, 1.2)
        );
        player.renderVelocity = { ...player.data.velocity };
      }
    }
  }, [localPlayerId]);

  /**
   * Get render-ready player data for the current frame
   */
  const getRenderPlayers = useCallback((): Map<string, PredictedPlayer> => {
    return playersRef.current;
  }, []);

  return useMemo(() => ({
    onServerState,
    onLocalInput,
    updateRenderPositions,
    getRenderPlayers,
  }), [onServerState, onLocalInput, updateRenderPositions, getRenderPlayers]);
}
