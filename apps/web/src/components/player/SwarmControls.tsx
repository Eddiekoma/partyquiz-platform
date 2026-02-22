"use client";

import { useMemo, useEffect, useState } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import { AbilityButton } from "./AbilityButton";
import { SwanChaseGameHUD } from "./SwanChaseGameHUD";
import { GameEndOverlay } from "./GameEndOverlay";
import { useSwanChaseControls } from "@/hooks/useSwanChaseControls";
import type { SwanChaseGameState } from "@partyquiz/shared";
import { SwanChasePlayerStatus } from "@partyquiz/shared";

interface SwarmControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  socket: any;
}

export function SwarmControls({
  sessionCode: _sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  socket,
}: SwarmControlsProps) {
  const {
    myPlayer,
    gameStatus,
    handleJoystickMove,
    handleJoystickStop,
    sprint,
  } = useSwanChaseControls({
    playerId,
    gameState,
    socket,
    onMove,
    onSprint,
  });

  const playersAlive = gameState?.playersAlive
    ?? gameState?.players.filter((p) => p.status !== SwanChasePlayerStatus.ELIMINATED).length
    ?? 0;
  const currentWave = gameState?.currentWave ?? 1;
  const aiSwans = gameState?.aiSwans ?? [];

  // Count nearby AI swans
  const [nearbyAICount, setNearbyAICount] = useState(0);
  useEffect(() => {
    if (!myPlayer || !aiSwans.length) {
      setNearbyAICount(0);
      return;
    }
    let count = 0;
    for (const ai of aiSwans) {
      const dx = ai.position.x - myPlayer.position.x;
      const dy = ai.position.y - myPlayer.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < 250) count++;
    }
    setNearbyAICount(count);
  }, [gameState, myPlayer, aiSwans]);

  // Overlay
  const overlayVariant = useMemo(() => {
    if (!gameState || !myPlayer) return { type: "waiting" as const };
    if (gameStatus === "COUNTDOWN") {
      const countdown = gameState.startTime
        ? Math.ceil((gameState.startTime - Date.now()) / 1000)
        : undefined;
      return { type: "waiting" as const, countdown };
    }
    if (myPlayer.status === SwanChasePlayerStatus.ELIMINATED) {
      return { type: "eliminated" as const, message: "An AI swan got you" };
    }
    return null;
  }, [gameState, myPlayer, gameStatus]);

  // HUD stats
  const hudStats = useMemo(() => {
    if (!gameState) return [];
    return [
      { label: "Crew", value: playersAlive, color: "text-green-400" },
      { label: "Wave", value: `#${currentWave}`, color: "text-purple-400" },
      { label: "Swans", value: aiSwans.length, color: "text-red-400" },
    ];
  }, [gameState, playersAlive, currentWave, aiSwans.length]);

  const isEliminated = myPlayer?.status === SwanChasePlayerStatus.ELIMINATED;

  return (
    <div
      className={`flex flex-col h-full text-white p-4 ${
        isEliminated
          ? "bg-gradient-to-b from-gray-800 to-gray-950"
          : "bg-gradient-to-b from-purple-900 to-purple-950"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{isEliminated ? "\u{1F480}" : "\u{1F6A3}"}</div>
          <div>
            <h2 className="text-lg font-bold">Swan Swarm</h2>
            <p className="text-sm opacity-75">{myPlayer?.name || "Player"}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full font-bold text-xs ${
            isEliminated
              ? "bg-red-500"
              : gameStatus === "COUNTDOWN"
              ? "bg-gray-500"
              : "bg-purple-500 animate-pulse"
          }`}
        >
          {isEliminated ? "CAUGHT" : gameStatus === "COUNTDOWN" ? "WAIT" : "ALIVE"}
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
            {/* Danger indicator */}
            {nearbyAICount > 0 && (
              <div
                className={`border rounded-lg p-3 text-center ${
                  nearbyAICount >= 3
                    ? "bg-red-900/40 border-red-500/60 animate-pulse"
                    : nearbyAICount >= 2
                    ? "bg-orange-900/30 border-orange-500/50"
                    : "bg-yellow-900/20 border-yellow-500/40"
                }`}
              >
                <p className="text-sm font-bold">
                  {nearbyAICount >= 3
                    ? "\u{1F6A8} DANGER! "
                    : nearbyAICount >= 2
                    ? "\u{26A0}\uFE0F Watch out! "
                    : "\u{1F440} "}
                  {nearbyAICount} AI swan{nearbyAICount !== 1 ? "s" : ""} nearby!
                </p>
              </div>
            )}

            {/* AI Swan count */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-300">&#x1F9A2; AI Swans Active</span>
                <span className="text-lg font-bold text-red-400">{aiSwans.length}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 items-center justify-center mt-auto pt-4">
              <VirtualJoystick
                size={180}
                maxDistance={70}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color="#a855f7"
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
            <div className="mt-3 p-2.5 bg-black/20 rounded-lg text-center">
              <p className="text-xs opacity-75">
                <span className="font-bold">Survive the swarm together!</span>
                <br />
                Joystick/WASD to move &bull; Shift/Space to sprint
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer Stats */}
      {gameState && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-black/20 rounded-lg p-2">
          <div>
            <div className="text-[10px] opacity-75">Crew Alive</div>
            <div className="text-lg font-bold text-green-400">{playersAlive}</div>
          </div>
          <div>
            <div className="text-[10px] opacity-75">Caught</div>
            <div className="text-lg font-bold text-red-400">
              {gameState.players.length - playersAlive}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-75">Wave</div>
            <div className="text-lg font-bold text-purple-400">#{currentWave}</div>
          </div>
        </div>
      )}
    </div>
  );
}
