"use client";

import { useMemo, useCallback } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import { AbilityButton } from "./AbilityButton";
import { SwanChaseGameHUD } from "./SwanChaseGameHUD";
import { ThreatRadar } from "./ThreatRadar";
import { GameEndOverlay } from "./GameEndOverlay";
import { useSwanChaseControls } from "@/hooks/useSwanChaseControls";
import type { SwanChaseGameState, SwanChasePlayer } from "@partyquiz/shared";
import { SwanChasePlayerStatus } from "@partyquiz/shared";

interface BoatControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  socket: any;
}

export function BoatControls({
  sessionCode: _sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  socket,
}: BoatControlsProps) {
  const threatFilter = useCallback(
    (p: SwanChasePlayer) => p.team === "WHITE" && p.status === SwanChasePlayerStatus.HUNTING,
    []
  );

  const {
    myPlayer,
    canMove,
    gameStatus,
    handleJoystickMove,
    handleJoystickStop,
    sprint,
    nearbyEntities,
    safeZoneDistance,
  } = useSwanChaseControls({
    playerId,
    gameState,
    socket,
    onMove,
    onSprint,
    detectionRadius: 300,
    threatFilter,
  });

  // Player status for overlay display
  const overlayVariant = useMemo(() => {
    if (!gameState || !myPlayer) return { type: "waiting" as const };
    if (gameStatus === "COUNTDOWN") {
      const countdown = gameState.startTime
        ? Math.ceil((gameState.startTime - Date.now()) / 1000)
        : undefined;
      return { type: "waiting" as const, countdown };
    }
    if (myPlayer.status === SwanChasePlayerStatus.SAFE) return { type: "safe" as const };
    if (myPlayer.status === SwanChasePlayerStatus.TAGGED) return { type: "tagged" as const };
    return null;
  }, [gameState, myPlayer, gameStatus]);

  // HUD stats
  const hudStats = useMemo(() => {
    if (!gameState) return [];
    const alive = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.ACTIVE).length;
    const safe = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.SAFE).length;
    const tagged = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.TAGGED).length;
    return [
      { label: "Alive", value: alive, color: "text-blue-400" },
      { label: "Safe", value: safe, color: "text-yellow-400" },
      { label: "Tagged", value: tagged, color: "text-red-400" },
    ];
  }, [gameState]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-900 to-blue-950 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">&#x1F6E5;&#xFE0F;</div>
          <div>
            <h2 className="text-lg font-bold">Blue Team</h2>
            <p className="text-sm text-blue-300">{myPlayer?.name || "Player"}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full font-bold text-xs ${
            canMove
              ? "bg-green-500 animate-pulse"
              : myPlayer?.status === SwanChasePlayerStatus.TAGGED
              ? "bg-red-500"
              : myPlayer?.status === SwanChasePlayerStatus.SAFE
              ? "bg-yellow-500"
              : "bg-gray-500"
          }`}
        >
          {myPlayer?.status || "WAIT"}
        </div>
      </div>

      {/* HUD */}
      {gameState && <SwanChaseGameHUD gameState={gameState} stats={hudStats} />}

      {/* Content */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {/* Overlay states */}
        {overlayVariant ? (
          <GameEndOverlay variant={overlayVariant} playerName={myPlayer?.name} />
        ) : (
          <>
            {/* Threat radar */}
            <ThreatRadar
              entities={nearbyEntities}
              label="Nearby Swans"
              headerIcon="&#x26A0;&#xFE0F;"
              color="red"
            />

            {/* Safe zone distance */}
            {safeZoneDistance !== null && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-300">&#x1F3AF; Safe Zone</span>
                  <span className="text-lg font-mono font-bold text-green-400">
                    {safeZoneDistance}m
                  </span>
                </div>
                {safeZoneDistance < 100 && (
                  <p className="text-xs text-green-200 mt-1">Almost there!</p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-4 items-center justify-center mt-auto pt-4">
              <VirtualJoystick
                size={180}
                maxDistance={70}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color="#60a5fa"
              />
              <AbilityButton
                ability={sprint}
                onClick={onSprint}
                label="SPRINT"
                activeLabel="SPRINTING!"
                icon="&#x1F680;"
                activeIcon="&#x26A1;"
                size={110}
              />
            </div>

            {/* Instructions */}
            <div className="mt-3 p-2.5 bg-blue-800/30 rounded-lg text-center">
              <p className="text-xs text-blue-200">
                <span className="font-bold">Escape to the safe zone!</span>
                <br />
                Joystick/WASD to move &bull; Shift/Space to sprint
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
