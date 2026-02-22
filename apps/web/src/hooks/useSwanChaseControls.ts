"use client";

/**
 * Shared Controls Hook for all Swan Chase game modes.
 *
 * Extracts the ~200 lines of duplicated logic from BoatControls,
 * SwanControls, KingOfLakeControls, and SwarmControls into one hook.
 *
 * Handles:
 * - Player lookup from game state
 * - Movement interval (20 Hz) with stable onMove ref
 * - Joystick event handlers
 * - Sprint & dash cooldown tracking
 * - Keyboard bindings (Shift/Space)
 * - "Can I move?" status derivation
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SwanChaseGameState, SwanChasePlayer, Vector2D } from "@partyquiz/shared";
import { SwanChasePlayerStatus } from "@partyquiz/shared";

// Which statuses prevent the player from moving
const IMMOBILE_STATUSES = new Set([
  SwanChasePlayerStatus.TAGGED,
  SwanChasePlayerStatus.SAFE,
  SwanChasePlayerStatus.ELIMINATED,
]);

export interface JoystickPosition {
  x: number;
  y: number;
  angle: number;
  distance: number;
}

export interface AbilityCooldown {
  ready: boolean;
  active: boolean;
  cooldownMs: number;       // ms remaining
  cooldownFraction: number; // 0..1 (1 = full cooldown)
  charges: number;
}

export interface NearbyEntity {
  id: string;
  name: string;
  distance: number;
  angle: number; // degrees, 0=up
  isKing?: boolean;
  status?: string;
}

export interface UseSwanChaseControlsOptions {
  playerId: string;
  gameState: SwanChaseGameState | null;
  socket: any;
  onMove: (angle: number, speed: number) => void;
  onSprint?: () => void;
  onDash?: () => void;
  /** Statuses that allow movement (default: derived from IMMOBILE_STATUSES) */
  canMoveStatuses?: SwanChasePlayerStatus[];
  /** Keyboard key for sprint (default: "Shift") */
  sprintKey?: string;
  /** Keyboard key for dash (default: " ") */
  dashKey?: string;
  /** Sprint total cooldown for ring calculation (default: 5000ms) */
  sprintTotalCooldownMs?: number;
  /** Dash total cooldown for ring calculation (default: 8000ms) */
  dashTotalCooldownMs?: number;
  /** Entity detection radius (default: 300) */
  detectionRadius?: number;
  /** Filter for which players count as "threats" */
  threatFilter?: (player: SwanChasePlayer, myPlayer: SwanChasePlayer) => boolean;
}

export function useSwanChaseControls({
  playerId,
  gameState,
  socket,
  onMove,
  onSprint,
  onDash,
  canMoveStatuses,
  sprintKey = "Shift",
  dashKey = " ",
  sprintTotalCooldownMs = 5000,
  dashTotalCooldownMs = 8000,
  detectionRadius = 300,
  threatFilter,
}: UseSwanChaseControlsOptions) {
  // ── Player lookup ──────────────────────────────────────────────────
  const myPlayer = gameState?.players.find((p) => p.id === playerId) ?? null;

  // ── Can the player move? ───────────────────────────────────────────
  const canMove = useMemo(() => {
    if (!gameState || !myPlayer) return false;
    if (gameState.status === "COUNTDOWN") return false;
    if (canMoveStatuses) {
      return canMoveStatuses.includes(myPlayer.status);
    }
    return !IMMOBILE_STATUSES.has(myPlayer.status);
  }, [gameState, myPlayer, canMoveStatuses]);

  // ── Stable onMove ref (prevents interval teardown on parent rerenders) ──
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  // ── Movement interval ──────────────────────────────────────────────
  const currentMoveRef = useRef<{ angle: number; speed: number } | null>(null);
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!canMove) return;

    movementIntervalRef.current = setInterval(() => {
      if (currentMoveRef.current && socket) {
        onMoveRef.current(currentMoveRef.current.angle, currentMoveRef.current.speed);
      }
    }, 50); // 20 Hz

    return () => {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove, socket]);

  // ── Joystick handlers ──────────────────────────────────────────────
  const handleJoystickMove = useCallback(
    (position: JoystickPosition) => {
      if (!canMove) return;
      if (position.distance < 0.1) {
        currentMoveRef.current = null;
        return;
      }
      currentMoveRef.current = { angle: position.angle, speed: position.distance };
    },
    [canMove]
  );

  const handleJoystickStop = useCallback(() => {
    currentMoveRef.current = null;
  }, []);

  // ── Sprint cooldown ────────────────────────────────────────────────
  const [sprintCooldownMs, setSprintCooldownMs] = useState(0);
  const sprintActive = myPlayer?.abilities.sprint?.active ?? false;

  useEffect(() => {
    if (!myPlayer?.abilities.sprint) return;
    const cooldownUntil = myPlayer.abilities.sprint.cooldownUntil || 0;
    const now = Date.now();
    const remaining = Math.max(0, cooldownUntil - now);
    setSprintCooldownMs(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        const r = Math.max(0, cooldownUntil - Date.now());
        setSprintCooldownMs(r);
        if (r === 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [myPlayer?.abilities.sprint?.cooldownUntil]);

  const sprint: AbilityCooldown = useMemo(
    () => ({
      ready: sprintCooldownMs === 0 && !sprintActive && canMove,
      active: sprintActive,
      cooldownMs: sprintCooldownMs,
      cooldownFraction: sprintTotalCooldownMs > 0 ? sprintCooldownMs / sprintTotalCooldownMs : 0,
      charges: myPlayer?.abilities.sprint?.charges ?? 0,
    }),
    [sprintCooldownMs, sprintActive, canMove, sprintTotalCooldownMs, myPlayer?.abilities.sprint?.charges]
  );

  // ── Dash cooldown ──────────────────────────────────────────────────
  const [dashCooldownMs, setDashCooldownMs] = useState(0);
  const dashActive = myPlayer?.abilities.dash?.active ?? false;

  useEffect(() => {
    if (!myPlayer?.abilities.dash) return;
    const cooldownUntil = myPlayer.abilities.dash.cooldownUntil || 0;
    const now = Date.now();
    const remaining = Math.max(0, cooldownUntil - now);
    setDashCooldownMs(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        if (!myPlayer?.abilities.dash) return;
        const r = Math.max(0, cooldownUntil - Date.now());
        setDashCooldownMs(r);
        if (r === 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [myPlayer?.abilities.dash?.cooldownUntil]);

  const dash: AbilityCooldown = useMemo(
    () => ({
      ready: dashCooldownMs === 0 && !dashActive && canMove,
      active: dashActive,
      cooldownMs: dashCooldownMs,
      cooldownFraction: dashTotalCooldownMs > 0 ? dashCooldownMs / dashTotalCooldownMs : 0,
      charges: myPlayer?.abilities.dash?.charges ?? 0,
    }),
    [dashCooldownMs, dashActive, canMove, dashTotalCooldownMs, myPlayer?.abilities.dash?.charges]
  );

  // ── Keyboard support ───────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === sprintKey && sprint.ready && onSprint) {
        e.preventDefault();
        onSprint();
      }
      if (e.key === dashKey && dash.ready && onDash) {
        e.preventDefault();
        onDash();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sprint.ready, dash.ready, sprintKey, dashKey, onSprint, onDash]);

  // ── Nearby entities ────────────────────────────────────────────────
  const nearbyEntities = useMemo<NearbyEntity[]>(() => {
    if (!gameState || !myPlayer || !threatFilter) return [];

    const result: NearbyEntity[] = [];
    for (const p of gameState.players) {
      if (p.id === playerId) continue;
      if (!threatFilter(p, myPlayer)) continue;

      const dx = p.position.x - myPlayer.position.x;
      const dy = p.position.y - myPlayer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < detectionRadius) {
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = ((angleRad * 180) / Math.PI + 90 + 360) % 360;
        result.push({
          id: p.id,
          name: p.name,
          distance: Math.round(distance),
          angle: angleDeg,
          isKing: p.id === gameState.currentKingId,
          status: p.status,
        });
      }
    }
    result.sort((a, b) => a.distance - b.distance);
    return result.slice(0, 6);
  }, [gameState, myPlayer, playerId, detectionRadius, threatFilter]);

  // ── Safe zone distance ─────────────────────────────────────────────
  const safeZoneDistance = useMemo<number | null>(() => {
    if (!gameState?.settings.safeZone || !myPlayer) return null;
    const sz = gameState.settings.safeZone;
    const dx = sz.position.x - myPlayer.position.x;
    const dy = sz.position.y - myPlayer.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) - sz.radius;
    return Math.max(0, Math.round(dist));
  }, [gameState, myPlayer]);

  // ── Timer display ──────────────────────────────────────────────────
  const timeRemaining = gameState?.timeRemaining ?? 0;

  return {
    myPlayer,
    canMove,
    gameStatus: gameState?.status ?? null,
    timeRemaining,

    // Joystick
    handleJoystickMove,
    handleJoystickStop,

    // Abilities
    sprint,
    dash,

    // Awareness
    nearbyEntities,
    safeZoneDistance,

    // Game state pass-through
    gameState,
  };
}
