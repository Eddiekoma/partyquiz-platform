"use client";

import { useEffect, useState, useRef } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import type { SwanChaseGameState } from "@partyquiz/shared";

interface SwarmControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  socket: any;
}

type PlayerStatus = "ACTIVE" | "ELIMINATED" | "WAITING";

export function SwarmControls({
  sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  socket,
}: SwarmControlsProps) {
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("WAITING");
  const [sprintCooldown, setSprintCooldown] = useState(0);
  const [nearbyAISwans, setNearbyAISwans] = useState(0);
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentMoveRef = useRef<{ angle: number; speed: number } | null>(null);

  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const playersAlive = (gameState as any)?.playersAlive ?? gameState?.players.filter(p => (p.status as string) !== "ELIMINATED").length ?? 0;
  const currentWave = (gameState as any)?.currentWave ?? 1;
  const aiSwans = (gameState as any)?.aiSwans ?? [];

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
    } else {
      setPlayerStatus("ACTIVE");
    }
  }, [gameState, myPlayer]);

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

  // Count nearby AI swans
  useEffect(() => {
    if (!myPlayer || !aiSwans.length) {
      setNearbyAISwans(0);
      return;
    }

    let count = 0;
    aiSwans.forEach((ai: any) => {
      const dx = ai.position.x - myPlayer.position.x;
      const dy = ai.position.y - myPlayer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 250) count++;
    });
    setNearbyAISwans(count);
  }, [gameState, myPlayer, aiSwans]);

  // Handle joystick movement
  const handleJoystickMove = (position: { x: number; y: number; angle: number; distance: number }) => {
    if (playerStatus !== "ACTIVE") return;

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
    if (playerStatus !== "ACTIVE") return;

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

  const canSprint = sprintCooldown === 0 && playerStatus === "ACTIVE";

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === "Shift" || e.key === " ") && canSprint) {
        e.preventDefault();
        onSprint();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSprint]);

  return (
    <div className={`flex flex-col h-full text-white p-4 ${
      playerStatus === "ELIMINATED"
        ? "bg-gradient-to-b from-gray-800 to-gray-950"
        : "bg-gradient-to-b from-purple-900 to-purple-950"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{playerStatus === "ELIMINATED" ? "💀" : "🚣"}</div>
          <div>
            <h2 className="text-xl font-bold">Swan Swarm</h2>
            <p className="text-sm opacity-75">{myPlayer?.name || "Player"}</p>
          </div>
        </div>

        <div className={`px-4 py-2 rounded-full font-bold text-sm ${
          playerStatus === "ACTIVE" ? "bg-purple-500 animate-pulse" :
          playerStatus === "ELIMINATED" ? "bg-red-500" :
          "bg-gray-500"
        }`}>
          {playerStatus === "ACTIVE" ? "ALIVE" : playerStatus === "ELIMINATED" ? "CAUGHT" : "WAIT"}
        </div>
      </div>

      {/* Game Info */}
      {gameState && (
        <div className="bg-black/20 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs opacity-75">Time</div>
              <div className="text-xl font-mono font-bold">
                {Math.ceil((gameState.timeRemaining || 0) / 1000)}s
              </div>
            </div>
            <div>
              <div className="text-xs opacity-75">Wave</div>
              <div className="text-xl font-bold text-purple-400">#{currentWave}</div>
            </div>
            <div>
              <div className="text-xs opacity-75">Crew</div>
              <div className="text-xl font-bold text-green-400">{playersAlive}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* WAITING */}
        {playerStatus === "WAITING" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">🦢</div>
            <p className="text-2xl font-bold mb-2">Swan Swarm</p>
            <p className="opacity-75">Survive together against waves of AI swans!</p>
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
            <p className="text-3xl font-bold text-red-400 mb-2">Caught!</p>
            <p className="text-lg text-red-300">An AI swan got you</p>
            <div className="mt-6 p-4 bg-red-900/50 rounded-lg">
              <p className="text-sm text-red-200">Cheer on your crew mates! {playersAlive} still alive</p>
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {playerStatus === "ACTIVE" && (
          <>
            {/* Danger indicator */}
            {nearbyAISwans > 0 && (
              <div className={`border rounded-lg p-3 text-center ${
                nearbyAISwans >= 3
                  ? "bg-red-900/40 border-red-500/60 animate-pulse"
                  : nearbyAISwans >= 2
                  ? "bg-orange-900/30 border-orange-500/50"
                  : "bg-yellow-900/20 border-yellow-500/40"
              }`}>
                <p className="text-sm font-bold">
                  {nearbyAISwans >= 3 ? "🚨 DANGER! " : nearbyAISwans >= 2 ? "⚠️ Watch out! " : "👀 "}
                  {nearbyAISwans} AI swan{nearbyAISwans !== 1 ? "s" : ""} nearby!
                </p>
              </div>
            )}

            {/* AI Swan count */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-300">🦢 AI Swans Active</span>
                <span className="text-lg font-bold text-red-400">{aiSwans.length}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 items-center justify-center mt-4">
              <VirtualJoystick
                size={180}
                maxDistance={70}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color="#a855f7"
              />

              <button
                onClick={() => canSprint && onSprint()}
                disabled={!canSprint}
                className={`relative w-32 h-32 rounded-full font-bold text-lg transition-all ${
                  canSprint
                    ? "bg-green-500 hover:bg-green-600 active:scale-95 shadow-lg"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                {sprintCooldown > 0 ? (
                  <>
                    <div className="text-2xl">⏱️</div>
                    <div className="text-xs mt-1">{(sprintCooldown / 1000).toFixed(1)}s</div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl">🚀</div>
                    <div className="text-xs mt-1">SPRINT</div>
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-black/20 rounded-lg text-center">
              <p className="text-sm opacity-75">
                <span className="font-bold">Survive the swarm together!</span>
                <br />
                Joystick/WASD to move • Shift/Space to sprint
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer Stats */}
      {gameState && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center bg-black/20 rounded-lg p-2">
          <div>
            <div className="text-xs opacity-75">Crew Alive</div>
            <div className="text-xl font-bold text-green-400">{playersAlive}</div>
          </div>
          <div>
            <div className="text-xs opacity-75">Caught</div>
            <div className="text-xl font-bold text-red-400">
              {gameState.players.length - playersAlive}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-75">Wave</div>
            <div className="text-xl font-bold text-purple-400">#{currentWave}</div>
          </div>
        </div>
      )}
    </div>
  );
}
