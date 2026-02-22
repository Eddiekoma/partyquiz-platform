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

interface KingOfLakeControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  onDash: () => void;
  socket: any;
}

export function KingOfLakeControls({
  sessionCode: _sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  onDash,
  socket,
}: KingOfLakeControlsProps) {
  const isKing = playerId === gameState?.currentKingId;

  const threatFilter = useCallback(
    (p: SwanChasePlayer) => p.status !== SwanChasePlayerStatus.ELIMINATED,
    []
  );

  const {
    myPlayer,
    gameStatus,
    handleJoystickMove,
    handleJoystickStop,
    sprint,
    dash,
    nearbyEntities,
  } = useSwanChaseControls({
    playerId,
    gameState,
    socket,
    onMove,
    onSprint,
    onDash,
    sprintKey: "Shift",
    dashKey: " ",
    detectionRadius: 400,
    threatFilter,
    canMoveStatuses: [
      SwanChasePlayerStatus.ACTIVE,
      SwanChasePlayerStatus.KING,
      SwanChasePlayerStatus.HUNTING,
      SwanChasePlayerStatus.DASHING,
    ],
  });

  const playersAlive = gameState?.playersAlive
    ?? gameState?.players.filter((p) => p.status !== SwanChasePlayerStatus.ELIMINATED).length
    ?? 0;
  const kingPlayer = gameState?.players.find((p) => p.id === gameState?.currentKingId);

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
      return { type: "eliminated" as const, message: "The king got you" };
    }
    return null;
  }, [gameState, myPlayer, gameStatus]);

  // HUD stats
  const hudStats = useMemo(() => {
    if (!gameState) return [];
    return [
      { label: "Alive", value: playersAlive, color: "text-green-400" },
      { label: "Out", value: gameState.players.length - playersAlive, color: "text-red-400" },
    ];
  }, [gameState, playersAlive]);

  const joystickColor = isKing ? "#eab308" : "#818cf8";

  return (
    <div
      className={`flex flex-col h-full text-white p-4 ${
        isKing
          ? "bg-gradient-to-b from-yellow-900 to-amber-950"
          : myPlayer?.status === SwanChasePlayerStatus.ELIMINATED
          ? "bg-gradient-to-b from-gray-800 to-gray-950"
          : "bg-gradient-to-b from-indigo-900 to-indigo-950"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{isKing ? "\u{1F451}" : myPlayer?.status === SwanChasePlayerStatus.ELIMINATED ? "\u{1F480}" : "\u{2694}\uFE0F"}</div>
          <div>
            <h2 className="text-lg font-bold">
              {isKing ? "You are the KING!" : "King of the Lake"}
            </h2>
            <p className="text-sm opacity-75">{myPlayer?.name || "Player"}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full font-bold text-xs ${
            isKing
              ? "bg-yellow-500 animate-pulse"
              : myPlayer?.status === SwanChasePlayerStatus.ELIMINATED
              ? "bg-red-500"
              : "bg-indigo-500 animate-pulse"
          }`}
        >
          {isKing ? "\u{1F451} KING" : myPlayer?.status === SwanChasePlayerStatus.ELIMINATED ? "OUT" : "ALIVE"}
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
            {/* King info banner */}
            {!isKing && kingPlayer && (
              <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-lg p-3 text-center">
                <p className="text-sm text-yellow-300">
                  &#x1F451; <span className="font-bold">{kingPlayer.name}</span> is the King
                </p>
                <p className="text-xs text-yellow-200 mt-1">Dash into them to steal the crown!</p>
              </div>
            )}

            {isKing && (
              <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-lg p-3 text-center animate-pulse">
                <p className="text-lg font-bold text-yellow-300">&#x1F451; You are the King!</p>
                <p className="text-xs text-yellow-200 mt-1">
                  Tag players to eliminate them. Don&apos;t let anyone dash into you!
                </p>
              </div>
            )}

            {/* Nearby Players */}
            <ThreatRadar
              entities={nearbyEntities}
              label="Nearby Players"
              headerIcon="&#x1F4E1;"
              color={isKing ? "orange" : "purple"}
              closeThreshold={100}
              showKingBadge
            />

            {/* Controls */}
            <div className="flex gap-3 items-center justify-center mt-auto pt-4">
              <VirtualJoystick
                size={160}
                maxDistance={65}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color={joystickColor}
              />
              <AbilityButton
                ability={sprint}
                onClick={onSprint}
                label="SPRINT"
                icon="&#x1F680;"
                size={88}
              />
              <AbilityButton
                ability={dash}
                onClick={onDash}
                label={isKing ? "TAG" : "DASH"}
                activeLabel={isKing ? "TAGGING!" : "DASHING!"}
                icon={isKing ? "&#x26A1;" : "&#x1F4A5;"}
                readyColor={
                  isKing
                    ? "bg-red-500 hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/50"
                    : "bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-500/50"
                }
                size={88}
              />
            </div>

            {/* Instructions */}
            <div className="mt-3 p-2.5 bg-black/20 rounded-lg text-center">
              <p className="text-xs opacity-75">
                {isKing ? (
                  <>
                    <span className="font-bold">Tag others to eliminate them!</span>
                    <br />
                    Joystick to move &bull; Shift to sprint &bull; Space to tag
                  </>
                ) : (
                  <>
                    <span className="font-bold">Dash into the king to steal the crown!</span>
                    <br />
                    Joystick to move &bull; Shift to sprint &bull; Space to dash
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
