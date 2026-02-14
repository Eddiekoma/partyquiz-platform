"use client";

import { useEffect, useState, useRef } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import type { SwanChaseGameState } from "@partyquiz/shared";

interface KingOfLakeControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  onDash: () => void;
  socket: any;
}

type PlayerStatus = "ACTIVE" | "KING" | "ELIMINATED" | "WAITING";

export function KingOfLakeControls({
  sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  onDash,
  socket,
}: KingOfLakeControlsProps) {
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("WAITING");
  const [sprintCooldown, setSprintCooldown] = useState(0);
  const [dashCooldown, setDashCooldown] = useState(0);
  const [nearbyPlayers, setNearbyPlayers] = useState<Array<{ id: string; name: string; distance: number; isKing: boolean }>>([]);
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentMoveRef = useRef<{ angle: number; speed: number } | null>(null);

  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const currentKingId = (gameState as any)?.currentKingId;
  const isKing = playerId === currentKingId;
  const playersAlive = (gameState as any)?.playersAlive ?? gameState?.players.filter(p => (p.status as string) !== "ELIMINATED").length ?? 0;

  // Determine player status
  useEffect(() => {
    if (!gameState || !myPlayer) {
      setPlayerStatus("WAITING");
      return;
    }

    if (gameState.status === "COUNTDOWN") {
      setPlayerStatus("WAITING");
    } else if ((myPlayer.status as string) === "ELIMINATED") {
      setPlayerStatus("ELIMINATED");
    } else if (isKing) {
      setPlayerStatus("KING");
    } else {
      setPlayerStatus("ACTIVE");
    }
  }, [gameState, myPlayer, isKing]);

  // Update sprint cooldown
  useEffect(() => {
    if (!myPlayer?.abilities.sprint) return;

    const now = Date.now();
    const cooldownRemaining = Math.max(0, (myPlayer.abilities.sprint.cooldownUntil || 0) - now);
    setSprintCooldown(cooldownRemaining);

    if (cooldownRemaining > 0) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, (myPlayer.abilities.sprint.cooldownUntil || 0) - Date.now());
        setSprintCooldown(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [myPlayer?.abilities.sprint?.cooldownUntil]);

  // Update dash cooldown
  useEffect(() => {
    if (!myPlayer?.abilities.dash) return;

    const now = Date.now();
    const cooldownRemaining = Math.max(0, (myPlayer.abilities.dash.cooldownUntil || 0) - now);
    setDashCooldown(cooldownRemaining);

    if (cooldownRemaining > 0) {
      const interval = setInterval(() => {
        if (!myPlayer?.abilities.dash) return;
        const remaining = Math.max(0, (myPlayer.abilities.dash.cooldownUntil || 0) - Date.now());
        setDashCooldown(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [myPlayer?.abilities.dash?.cooldownUntil]);

  // Calculate nearby players
  useEffect(() => {
    if (!gameState || !myPlayer) return;

    const others = gameState.players.filter(
      (p) => p.id !== playerId && (p.status as string) !== "ELIMINATED"
    );
    const nearby: Array<{ id: string; name: string; distance: number; isKing: boolean }> = [];

    others.forEach((p) => {
      const dx = p.position.x - myPlayer.position.x;
      const dy = p.position.y - myPlayer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 400) {
        nearby.push({
          id: p.id,
          name: p.name,
          distance: Math.round(distance),
          isKing: p.id === currentKingId,
        });
      }
    });

    nearby.sort((a, b) => a.distance - b.distance);
    setNearbyPlayers(nearby.slice(0, 5));
  }, [gameState, myPlayer, currentKingId]);

  // Handle joystick movement
  const handleJoystickMove = (position: { x: number; y: number; angle: number; distance: number }) => {
    if (playerStatus === "WAITING" || playerStatus === "ELIMINATED") return;

    const speed = position.distance;
    if (speed < 0.1) {
      currentMoveRef.current = null;
      return;
    }

    currentMoveRef.current = { angle: position.angle, speed };
  };

  const handleJoystickStop = () => {
    currentMoveRef.current = null;
  };

  // Send movement updates
  useEffect(() => {
    if (playerStatus === "WAITING" || playerStatus === "ELIMINATED") return;

    movementIntervalRef.current = setInterval(() => {
      if (currentMoveRef.current && socket) {
        onMove(currentMoveRef.current.angle, currentMoveRef.current.speed);
      }
    }, 50);

    return () => {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
      }
    };
  }, [playerStatus, socket, onMove]);

  const canSprint = sprintCooldown === 0 && (playerStatus === "ACTIVE" || playerStatus === "KING");
  const canDash = dashCooldown === 0 && (playerStatus === "ACTIVE" || playerStatus === "KING");

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Shift" && canSprint) {
        e.preventDefault();
        onSprint();
      }
      if (e.key === " " && canDash) {
        e.preventDefault();
        onDash();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSprint, canDash]);

  // Find king name
  const kingPlayer = gameState?.players.find((p) => p.id === currentKingId);

  return (
    <div className={`flex flex-col h-full text-white p-4 ${
      isKing
        ? "bg-gradient-to-b from-yellow-900 to-amber-950"
        : playerStatus === "ELIMINATED"
        ? "bg-gradient-to-b from-gray-800 to-gray-950"
        : "bg-gradient-to-b from-indigo-900 to-indigo-950"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{isKing ? "👑" : playerStatus === "ELIMINATED" ? "💀" : "⚔️"}</div>
          <div>
            <h2 className="text-xl font-bold">
              {isKing ? "You are the KING!" : playerStatus === "ELIMINATED" ? "Eliminated" : "King of the Lake"}
            </h2>
            <p className="text-sm opacity-75">{myPlayer?.name || "Player"}</p>
          </div>
        </div>

        <div className={`px-4 py-2 rounded-full font-bold text-sm ${
          isKing ? "bg-yellow-500 animate-pulse" :
          playerStatus === "ELIMINATED" ? "bg-red-500" :
          "bg-indigo-500 animate-pulse"
        }`}>
          {isKing ? "👑 KING" : playerStatus === "ELIMINATED" ? "OUT" : "ALIVE"}
        </div>
      </div>

      {/* Game Timer */}
      {gameState && (
        <div className="bg-black/20 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm opacity-75">Time Left</span>
            <span className="text-2xl font-mono font-bold">
              {Math.ceil((gameState.timeRemaining || 0) / 1000)}s
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm opacity-75">Alive</span>
            <span className="text-lg font-bold text-green-400">{playersAlive}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* WAITING */}
        {playerStatus === "WAITING" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">⚔️</div>
            <p className="text-2xl font-bold mb-2">King of the Lake</p>
            <p className="opacity-75">The king tags to eliminate. Dash into the king to steal the crown!</p>
            {gameState?.status === "COUNTDOWN" && gameState.startTime && (
              <div className="text-6xl font-bold mt-4 animate-bounce">
                {Math.ceil((gameState.startTime - Date.now()) / 1000)}
              </div>
            )}
          </div>
        )}

        {/* ELIMINATED */}
        {playerStatus === "ELIMINATED" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-8xl mb-4">💀</div>
            <p className="text-3xl font-bold text-red-400 mb-2">Eliminated!</p>
            <p className="text-lg text-red-300">The king got you</p>
            <div className="mt-6 p-4 bg-red-900/50 rounded-lg">
              <p className="text-sm text-red-200">Watch the remaining players battle it out!</p>
            </div>
          </div>
        )}

        {/* ACTIVE or KING */}
        {(playerStatus === "ACTIVE" || playerStatus === "KING") && (
          <>
            {/* King info banner */}
            {!isKing && kingPlayer && (
              <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-lg p-3 text-center">
                <p className="text-sm text-yellow-300">
                  👑 <span className="font-bold">{kingPlayer.name}</span> is the King
                </p>
                <p className="text-xs text-yellow-200 mt-1">Dash into them to steal the crown!</p>
              </div>
            )}

            {isKing && (
              <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-lg p-3 text-center animate-pulse">
                <p className="text-lg font-bold text-yellow-300">👑 You are the King!</p>
                <p className="text-xs text-yellow-200 mt-1">Tag players to eliminate them. Don&apos;t let anyone dash into you!</p>
              </div>
            )}

            {/* Nearby Players */}
            {nearbyPlayers.length > 0 && (
              <div className="bg-black/20 border border-white/20 rounded-lg p-3">
                <h3 className="text-sm font-bold opacity-75 mb-2">📡 Nearby Players</h3>
                <div className="space-y-1">
                  {nearbyPlayers.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between text-sm rounded px-2 py-1 ${
                      p.isKing ? "bg-yellow-800/40 border border-yellow-500/30" : "bg-white/5"
                    }`}>
                      <span className="truncate flex-1">
                        {p.isKing ? "👑 " : ""}{p.name}
                      </span>
                      <span className={`font-mono ml-2 ${
                        p.distance < 100 ? "text-red-400 font-bold" : "opacity-75"
                      }`}>
                        {p.distance}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 items-center justify-center mt-4">
              {/* Joystick */}
              <VirtualJoystick
                size={160}
                maxDistance={65}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color={isKing ? "#eab308" : "#818cf8"}
              />

              {/* Sprint Button */}
              <button
                onClick={() => canSprint && onSprint()}
                disabled={!canSprint}
                className={`relative w-24 h-24 rounded-full font-bold text-sm transition-all ${
                  canSprint
                    ? "bg-green-500 hover:bg-green-600 active:scale-95 shadow-lg"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                {sprintCooldown > 0 ? (
                  <>
                    <div className="text-xl">⏱️</div>
                    <div className="text-xs mt-1">{(sprintCooldown / 1000).toFixed(1)}s</div>
                  </>
                ) : (
                  <>
                    <div className="text-xl">🚀</div>
                    <div className="text-xs mt-1">SPRINT</div>
                  </>
                )}
              </button>

              {/* Dash Button */}
              <button
                onClick={() => canDash && onDash()}
                disabled={!canDash}
                className={`relative w-24 h-24 rounded-full font-bold text-sm transition-all ${
                  canDash
                    ? isKing
                      ? "bg-red-500 hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/50"
                      : "bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-500/50"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                {dashCooldown > 0 ? (
                  <>
                    <div className="text-xl">⏱️</div>
                    <div className="text-xs mt-1">{(dashCooldown / 1000).toFixed(1)}s</div>
                  </>
                ) : (
                  <>
                    <div className="text-xl">{isKing ? "⚡" : "💥"}</div>
                    <div className="text-xs mt-1">{isKing ? "TAG" : "DASH"}</div>
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-black/20 rounded-lg text-center">
              <p className="text-sm opacity-75">
                {isKing ? (
                  <><span className="font-bold">Tag others to eliminate them!</span><br />Joystick to move • Shift to sprint • Space to tag</>
                ) : (
                  <><span className="font-bold">Dash into the king to steal the crown!</span><br />Joystick to move • Shift to sprint • Space to dash</>
                )}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer Stats */}
      {gameState && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center bg-black/20 rounded-lg p-2">
          <div>
            <div className="text-xs opacity-75">Players Alive</div>
            <div className="text-xl font-bold text-green-400">{playersAlive}</div>
          </div>
          <div>
            <div className="text-xs opacity-75">Eliminated</div>
            <div className="text-xl font-bold text-red-400">
              {gameState.players.length - playersAlive}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
