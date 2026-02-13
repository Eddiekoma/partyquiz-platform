"use client";

import { useEffect, useState, useRef } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import type { SwanChasePlayer, SwanChaseGameState } from "@partyquiz/shared";

interface BoatControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onSprint: () => void;
  socket: any;
}

type PlayerStatus = "ACTIVE" | "TAGGED" | "SAFE" | "WAITING";
type UIMode = "DETAILED" | "COMPACT" | "MINIMAL";

export function BoatControls({
  sessionCode,
  playerId,
  gameState,
  onMove,
  onSprint,
  socket,
}: BoatControlsProps) {
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("WAITING");
  const [sprintCooldown, setSprintCooldown] = useState(0);
  const [sprintDuration, setSprintDuration] = useState(0);
  const [uiMode, setUIMode] = useState<UIMode>("DETAILED");
  const [nearbySwans, setNearbySwans] = useState<Array<{ id: string; name: string; distance: number; angle: number }>>([]);
  const [distanceToSafeZone, setDistanceToSafeZone] = useState<number | null>(null);
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentMoveRef = useRef<{ angle: number; speed: number } | null>(null);

  // Find my player data
  const myPlayer = gameState?.players.find((p) => p.id === playerId);

  // Determine player status
  useEffect(() => {
    if (!gameState || !myPlayer) {
      setPlayerStatus("WAITING");
      return;
    }

    if (gameState.status === "COUNTDOWN") {
      setPlayerStatus("WAITING");
    } else if (myPlayer.status === "SAFE") {
      setPlayerStatus("SAFE");
    } else if (myPlayer.status === "TAGGED") {
      setPlayerStatus("TAGGED");
    } else {
      setPlayerStatus("ACTIVE");
    }
  }, [gameState, myPlayer]);

  // Update sprint cooldown
  useEffect(() => {
    if (!myPlayer) return;

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
  }, [myPlayer?.abilities.sprint.cooldownUntil]);

  // Update sprint duration (when active)
  useEffect(() => {
    if (!myPlayer) return;

    if (myPlayer.abilities.sprint.active) {
      setSprintDuration(1000); // Show active state
    } else {
      setSprintDuration(0);
    }
  }, [myPlayer?.abilities.sprint.active]);

  // Calculate nearby swans and distance to safe zone
  useEffect(() => {
    if (!gameState || !myPlayer) return;

    const swans = gameState.players.filter((p) => p.team === "WHITE" && p.status === "HUNTING");
    const nearby: Array<{ id: string; name: string; distance: number; angle: number }> = [];

    swans.forEach((swan) => {
      const dx = swan.position.x - myPlayer.position.x;
      const dy = swan.position.y - myPlayer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only show swans within 300 units
      if (distance < 300) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // 0° = up
        const normalizedAngle = (angle + 360) % 360;
        nearby.push({
          id: swan.id,
          name: swan.name,
          distance: Math.round(distance),
          angle: normalizedAngle,
        });
      }
    });

    // Sort by distance (closest first)
    nearby.sort((a, b) => a.distance - b.distance);
    setNearbySwans(nearby.slice(0, 5)); // Show max 5 closest

    // Calculate distance to safe zone
    if (gameState.settings.safeZone) {
      const dx = gameState.settings.safeZone.position.x - myPlayer.position.x;
      const dy = gameState.settings.safeZone.position.y - myPlayer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) - gameState.settings.safeZone.radius;
      setDistanceToSafeZone(Math.max(0, Math.round(dist)));
    }
  }, [gameState, myPlayer]);

  // Auto-adjust UI mode based on game state
  useEffect(() => {
    if (playerStatus === "WAITING") {
      setUIMode("DETAILED");
    } else if (playerStatus === "TAGGED" || playerStatus === "SAFE") {
      setUIMode("COMPACT");
    } else if (nearbySwans.length > 0) {
      setUIMode("COMPACT"); // Compact when swans are nearby
    } else {
      setUIMode("DETAILED");
    }
  }, [playerStatus, nearbySwans.length]);

  // Handle joystick movement
  const handleJoystickMove = (position: { x: number; y: number; angle: number; distance: number }) => {
    if (playerStatus !== "ACTIVE") return;

    const speed = position.distance; // 0 to 1
    if (speed < 0.1) {
      // Dead zone - stop movement
      currentMoveRef.current = null;
      return;
    }

    currentMoveRef.current = {
      angle: position.angle,
      speed: speed,
    };
  };

  const handleJoystickStop = () => {
    currentMoveRef.current = null;
  };

  // Send movement updates to server at regular intervals
  useEffect(() => {
    if (playerStatus !== "ACTIVE") return;

    movementIntervalRef.current = setInterval(() => {
      if (currentMoveRef.current && socket) {
        onMove(currentMoveRef.current.angle, currentMoveRef.current.speed);
      }
    }, 50); // 20 times per second

    return () => {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
      }
    };
  }, [playerStatus, socket, onMove]);

  const handleSprintClick = () => {
    if (sprintCooldown === 0 && sprintDuration === 0 && playerStatus === "ACTIVE") {
      onSprint();
    }
  };

  const canSprint = sprintCooldown === 0 && sprintDuration === 0 && playerStatus === "ACTIVE";
  const isSprinting = sprintDuration > 0;

  // Keyboard support for Sprint: Shift or Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === 'Shift' || e.key === ' ') && canSprint) {
        e.preventDefault();
        handleSprintClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSprint]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-900 to-blue-950 text-white p-4">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🚤</div>
          <div>
            <h2 className="text-xl font-bold">Blue Team - Boat</h2>
            <p className="text-sm text-blue-300">{myPlayer?.name || "Player"}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`px-4 py-2 rounded-full font-bold text-sm ${
            playerStatus === "ACTIVE"
              ? "bg-green-500 animate-pulse"
              : playerStatus === "TAGGED"
              ? "bg-red-500"
              : playerStatus === "SAFE"
              ? "bg-yellow-500"
              : "bg-gray-500"
          }`}
        >
          {playerStatus}
        </div>
      </div>

      {/* Game Phase Info */}
      {gameState && (
        <div className="bg-blue-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-200">Game Time</span>
            <span className="text-2xl font-mono font-bold">
              {Math.ceil((gameState.timeRemaining || 0) / 1000)}s
            </span>
          </div>
        </div>
      )}

      {/* Main Content - changes based on UI mode and status */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* WAITING STATE */}
        {playerStatus === "WAITING" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-2xl font-bold mb-2">Get Ready!</p>
            <p className="text-blue-300">Game starting soon...</p>
            {gameState?.status === "COUNTDOWN" && gameState.startTime && (
              <div className="text-6xl font-bold mt-4 animate-bounce">
                {Math.ceil((gameState.startTime - Date.now()) / 1000)}
              </div>
            )}
          </div>
        )}

        {/* TAGGED STATE */}
        {playerStatus === "TAGGED" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-8xl mb-4">💥</div>
            <p className="text-3xl font-bold text-red-400 mb-2">Tagged!</p>
            <p className="text-lg text-red-300">You were caught by a swan</p>
            <div className="mt-6 p-4 bg-red-900/50 rounded-lg">
              <p className="text-sm text-red-200">Watch the others escape!</p>
            </div>
          </div>
        )}

        {/* SAFE STATE */}
        {playerStatus === "SAFE" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-8xl mb-4">🎉</div>
            <p className="text-3xl font-bold text-yellow-400 mb-2">Safe!</p>
            <p className="text-lg text-yellow-300">You reached the safe zone</p>
            <div className="mt-6 p-4 bg-yellow-900/50 rounded-lg">
              <p className="text-sm text-yellow-200">Wait for the game to end</p>
            </div>
          </div>
        )}

        {/* ACTIVE STATE */}
        {playerStatus === "ACTIVE" && (
          <>
            {/* Proximity Radar */}
            {uiMode !== "MINIMAL" && nearbySwans.length > 0 && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
                <h3 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-2">
                  ⚠️ Nearby Swans
                </h3>
                <div className="space-y-1">
                  {nearbySwans.map((swan) => (
                    <div
                      key={swan.id}
                      className="flex items-center justify-between text-sm bg-red-800/30 rounded px-2 py-1"
                    >
                      <span className="truncate flex-1 text-white/90">{swan.name}</span>
                      <span className="text-red-300 font-mono ml-2">{swan.distance}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distance to Safe Zone */}
            {distanceToSafeZone !== null && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-300 flex items-center gap-2">
                    🎯 Safe Zone
                  </span>
                  <span className="text-lg font-mono font-bold text-green-400">
                    {distanceToSafeZone}m
                  </span>
                </div>
                {distanceToSafeZone < 100 && (
                  <p className="text-xs text-green-200 mt-1">Almost there! Keep going!</p>
                )}
              </div>
            )}

            {/* Controls Section */}
            <div className="flex gap-4 items-center justify-center mt-4">
              {/* Virtual Joystick */}
              <VirtualJoystick
                size={180}
                maxDistance={70}
                onMove={handleJoystickMove}
                onStop={handleJoystickStop}
                color="#60a5fa"
              />

              {/* Sprint Button */}
              <button
                onClick={handleSprintClick}
                disabled={!canSprint}
                className={`relative w-32 h-32 rounded-full font-bold text-lg transition-all ${
                  isSprinting
                    ? "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50"
                    : canSprint
                    ? "bg-green-500 hover:bg-green-600 active:scale-95 shadow-lg"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                {isSprinting ? (
                  <>
                    <div className="text-3xl">⚡</div>
                    <div className="text-xs mt-1">
                      {(sprintDuration / 1000).toFixed(1)}s
                    </div>
                  </>
                ) : sprintCooldown > 0 ? (
                  <>
                    <div className="text-2xl">⏱️</div>
                    <div className="text-xs mt-1">
                      {(sprintCooldown / 1000).toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl">🚀</div>
                    <div className="text-xs mt-1">SPRINT</div>
                  </>
                )}

                {/* Cooldown circle overlay */}
                {sprintCooldown > 0 && (
                  <svg
                    className="absolute inset-0 -rotate-90"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#ffffff40"
                      strokeWidth="4"
                      strokeDasharray={`${
                        (1 - sprintCooldown / 5000) * 283
                      } 283`}
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Instructions */}
            {uiMode === "DETAILED" && (
              <div className="mt-4 p-3 bg-blue-800/30 rounded-lg text-center">
                <p className="text-sm text-blue-200">
                  <span className="font-bold">Escape to the safe zone!</span>
                  <br />
                  Use joystick/WASD to move • Shift/Space to sprint
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Team Stats Footer */}
      {gameState && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center bg-blue-800/30 rounded-lg p-2">
          <div>
            <div className="text-xs text-blue-300">Alive</div>
            <div className="text-xl font-bold text-blue-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "ACTIVE").length}
            </div>
          </div>
          <div>
            <div className="text-xs text-yellow-300">Safe</div>
            <div className="text-xl font-bold text-yellow-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "SAFE").length}
            </div>
          </div>
          <div>
            <div className="text-xs text-red-300">Tagged</div>
            <div className="text-xl font-bold text-red-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "TAGGED").length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
