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

interface SwanControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onDash: () => void;
  socket: any;
}

export function SwanControls({
  sessionCode: _sessionCode,
  playerId,
  gameState,
  onMove,
  onDash,
  socket,
}: SwanControlsProps) {
  const threatFilter = useCallback(
    (p: SwanChasePlayer) => p.team === "BLUE",
    []
  );

  const {
    myPlayer,
    canMove,
    gameStatus,
    handleJoystickMove,
    handleJoystickStop,
    dash,
    nearbyEntities,
    safeZoneDistance,
  } = useSwanChaseControls({
    playerId,
    gameState,
    socket,
    onMove,
    onDash,
    sprintKey: "__disabled__", // Swans don't sprint
    dashKey: " ",
    detectionRadius: 400,
    threatFilter,
    canMoveStatuses: [SwanChasePlayerStatus.HUNTING, SwanChasePlayerStatus.DASHING],
  });

  // Overlay
  const overlayVariant = useMemo(() => {
    if (!gameState || !myPlayer) return { type: "waiting" as const };
    if (gameStatus === "COUNTDOWN") {
      const countdown = gameState.startTime
        ? Math.ceil((gameState.startTime - Date.now()) / 1000)
        : undefined;
      return { type: "waiting" as const, countdown };
    }
    return null; // Swans are always active once game starts
  }, [gameState, myPlayer, gameStatus]);

  // HUD stats
  const hudStats = useMemo(() => {
    if (!gameState) return [];
    const boatsActive = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.ACTIVE).length;
    const boatsSafe = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.SAFE).length;
    const boatsTagged = gameState.players.filter((p) => p.team === "BLUE" && p.status === SwanChasePlayerStatus.TAGGED).length;
    return [
      { label: "Active", value: boatsActive, color: "text-blue-400" },
      { label: "Safe", value: boatsSafe, color: "text-yellow-400" },
      { label: "Tagged", value: boatsTagged, color: "text-red-400" },
    ];
  }, [gameState]);

  // Tag stats
  const myTags = myPlayer?.tagsCount || 0;
  const totalTags = gameState?.players
    .filter((p) => p.team === "WHITE")
    .reduce((sum, p) => sum + (p.tagsCount || 0), 0) || 0;

  // Active nearby boats for coordination hint
  const activeNearby = nearbyEntities.filter((e) => e.status === SwanChasePlayerStatus.ACTIVE);
  const coordinationHint = useMemo(() => {
    if (activeNearby.length >= 2) {
      return `Team up on ${activeNearby[0].name}!`;
    }
    if (activeNearby.length === 1) {
      return activeNearby[0].distance < 100
        ? `${activeNearby[0].name} in range - GO!`
        : `Track ${activeNearby[0].name}`;
    }
    return null;
  }, [activeNearby]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-950 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">&#x1F9A2;</div>
          <div>
            <h2 className="text-lg font-bold">White Team</h2>
            <p className="text-sm text-slate-300">{myPlayer?.name || "Player"}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full font-bold text-xs ${
            canMove
              ? "bg-orange-500 animate-pulse"
              : "bg-gray-500"
          }`}
        >
          {myPlayer?.status === SwanChasePlayerStatus.DASHING ? "DASHING" : canMove ? "HUNTING" : "WAIT"}
        </div>
      </div>

      {/* HUD */}
      {gameState && <SwanChaseGameHUD gameState={gameState} stats={hudStats} />}

      {/* Content */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {overlayVariant ? (
          <GameEndOverlay variant={overlayVariant} playerName={myPlayer?.name} />
        ) : (
          <>
            {/* Tag stats */}
            <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-orange-300">Your Tags</div>
                  <div className="text-2xl font-bold text-orange-400">{myTags}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-yellow-300">Team Total</div>
                  <div className="text-2xl font-bold text-yellow-400">{totalTags}</div>
                </div>
              </div>
            </div>

            {/* Coordination hint */}
            {coordinationHint && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-2.5 text-center animate-pulse">
                <p className="text-sm font-bold text-blue-300">&#x1F3AF; {coordinationHint}</p>
              </div>
            )}

            {/* Boat radar */}
            <ThreatRadar
              entities={nearbyEntities}
              label="Nearby Boats"
              headerIcon="&#x1F3AF;"
              color="green"
              closeThreshold={100}
            />

            {/* Safe zone position (for blocking) */}
            {safeZoneDistance !== null && (
              <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-300">&#x1F3AF; Safe Zone</span>
                  <span className="text-lg font-mono font-bold text-purple-400">
                    {safeZoneDistance}m
                  </span>
                </div>
                {safeZoneDistance < 150 && (
                  <p className="text-xs text-purple-200 mt-1">Block the entrance!</p>
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
                color="#f97316"
              />
              <AbilityButton
                ability={dash}
                onClick={onDash}
                label="DASH"
                activeLabel="DASHING!"
                icon="&#x26A1;"
                activeIcon="&#x1F4A8;"
                readyColor="bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg"
                activeColor="bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50"
                size={110}
              />
            </div>

            {/* Instructions */}
            <div className="mt-3 p-2.5 bg-slate-800/30 rounded-lg text-center">
              <p className="text-xs text-slate-200">
                <span className="font-bold">Hunt down the blue boats!</span>
                <br />
                Joystick/WASD to chase &bull; Space to dash
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
