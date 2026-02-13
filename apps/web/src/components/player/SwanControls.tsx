"use client";

import { useEffect, useState, useRef } from "react";
import { VirtualJoystick } from "./VirtualJoystick";
import type { SwanChasePlayer, SwanChaseGameState } from "@partyquiz/shared";

interface SwanControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onMove: (angle: number, speed: number) => void;
  onDash: () => void;
  socket: any;
}

type PlayerStatus = "HUNTING" | "DASHING" | "WAITING";
type UIMode = "DETAILED" | "COMPACT" | "MINIMAL";

interface BoatTarget {
  id: string;
  name: string;
  distance: number;
  angle: number;
  status: "ACTIVE" | "TAGGED" | "SAFE";
}

export function SwanControls({
  sessionCode,
  playerId,
  gameState,
  onMove,
  onDash,
  socket,
}: SwanControlsProps) {
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("WAITING");
  const [dashCooldown, setDashCooldown] = useState(0);
  const [dashDuration, setDashDuration] = useState(0);
  const [uiMode, setUIMode] = useState<UIMode>("DETAILED");
  const [nearbyBoats, setNearbyBoats] = useState<BoatTarget[]>([]);
  const [distanceToSafeZone, setDistanceToSafeZone] = useState<number | null>(null);
  const [coordinationHint, setCoordinationHint] = useState<string | null>(null);
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
    } else if (myPlayer.status === "DASHING") {
      setPlayerStatus("DASHING");
    } else {
      setPlayerStatus("HUNTING");
    }
  }, [gameState, myPlayer]);

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
  }, [myPlayer?.abilities.dash?.cooldownUntil, myPlayer]);

  // Update dash duration (when active)
  useEffect(() => {
    if (!myPlayer?.abilities.dash) return;

    if (myPlayer.abilities.dash.active) {
      setDashDuration(1000); // Show active state
    } else {
      setDashDuration(0);
    }
  }, [myPlayer?.abilities.dash?.active]);

  // Calculate nearby boats and tactical info
  useEffect(() => {
    if (!gameState || !myPlayer) return;

    const boats = gameState.players.filter((p) => p.team === "BLUE");
    const nearby: BoatTarget[] = [];

    boats.forEach((boat) => {
      const dx = boat.position.x - myPlayer.position.x;
      const dy = boat.position.y - myPlayer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Show all boats within 400 units (larger range than boats see swans)
      if (distance < 400) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // 0° = up
        const normalizedAngle = (angle + 360) % 360;
        nearby.push({
          id: boat.id,
          name: boat.name,
          distance: Math.round(distance),
          angle: normalizedAngle,
          status: boat.status as "ACTIVE" | "TAGGED" | "SAFE",
        });
      }
    });

    // Sort by priority: ACTIVE boats first (taggable), then by distance
    nearby.sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return a.distance - b.distance;
    });

    setNearbyBoats(nearby.slice(0, 6)); // Show max 6 targets

    // Calculate distance to safe zone entrance (for blocking tactics)
    if (gameState.settings.safeZone) {
      const dx = gameState.settings.safeZone.position.x - myPlayer.position.x;
      const dy = gameState.settings.safeZone.position.y - myPlayer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setDistanceToSafeZone(Math.round(dist));
    }

    // Generate tactical hints based on game state
    generateCoordinationHint(nearby, boats, gameState);
  }, [gameState, myPlayer]);

  const generateCoordinationHint = (
    nearby: BoatTarget[],
    allBoats: SwanChasePlayer[],
    state: SwanChaseGameState
  ) => {
    const activeBoats = allBoats.filter((b) => b.status === "ACTIVE");
    const boatsInSafeZone = allBoats.filter((b) => b.status === "SAFE");

    if (activeBoats.length === 0) {
      setCoordinationHint(null);
      return;
    }

    // Critical: boats near safe zone
    if (distanceToSafeZone && distanceToSafeZone < 200) {
      setCoordinationHint("🎯 Block the safe zone entrance!");
      return;
    }

    // Multiple targets nearby - coordinate
    const activeNearby = nearby.filter((b) => b.status === "ACTIVE");
    if (activeNearby.length >= 2) {
      const closest = activeNearby[0];
      setCoordinationHint(`⚡ ${closest.name} is ${closest.distance}m away - Team up!`);
      return;
    }

    // Solo target
    if (activeNearby.length === 1) {
      const target = activeNearby[0];
      if (target.distance < 100) {
        setCoordinationHint(`🎯 ${target.name} in range - GO!`);
      } else {
        setCoordinationHint(`👀 Track ${target.name}`);
      }
      return;
    }

    // Many boats escaped
    if (boatsInSafeZone.length >= activeBoats.length) {
      setCoordinationHint("🏃 Hunt the remaining boats!");
      return;
    }

    // Default
    setCoordinationHint("🔍 Search for boats...");
  };

  // Auto-adjust UI mode based on game state
  useEffect(() => {
    if (playerStatus === "WAITING") {
      setUIMode("DETAILED");
    } else if (playerStatus === "DASHING") {
      setUIMode("MINIMAL"); // Focus mode during dash
    } else if (nearbyBoats.some((b) => b.status === "ACTIVE" && b.distance < 150)) {
      setUIMode("COMPACT"); // Combat mode
    } else {
      setUIMode("DETAILED");
    }
  }, [playerStatus, nearbyBoats]);

  // Handle joystick movement
  const handleJoystickMove = (position: { x: number; y: number; angle: number; distance: number }) => {
    if (playerStatus === "WAITING") return;

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
    if (playerStatus === "WAITING") return;

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

  const handleDashClick = () => {
    if (dashCooldown === 0 && dashDuration === 0 && playerStatus === "HUNTING") {
      onDash();
    }
  };

  const canDash = dashCooldown === 0 && dashDuration === 0 && playerStatus === "HUNTING";
  const isDashing = dashDuration > 0;

  // Keyboard support for Dash: Shift or Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === 'Shift' || e.key === ' ') && canDash) {
        e.preventDefault();
        handleDashClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canDash]);

  // Calculate team stats
  const myTags = myPlayer?.tagsCount || 0;
  const totalTags = gameState?.players
    .filter((p) => p.team === "WHITE")
    .reduce((sum, p) => sum + (p.tagsCount || 0), 0) || 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-950 text-white p-4">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🦢</div>
          <div>
            <h2 className="text-xl font-bold">White Team - Swan</h2>
            <p className="text-sm text-slate-300">{myPlayer?.name || "Player"}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`px-4 py-2 rounded-full font-bold text-sm ${
            playerStatus === "HUNTING"
              ? "bg-orange-500 animate-pulse"
              : playerStatus === "DASHING"
              ? "bg-yellow-500 animate-bounce"
              : "bg-gray-500"
          }`}
        >
          {playerStatus}
        </div>
      </div>

      {/* Game Phase Info */}
      {gameState && (
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Game Time</span>
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
            <p className="text-2xl font-bold mb-2">Get Ready to Hunt!</p>
            <p className="text-slate-300">Game starting soon...</p>
            {gameState?.status === "COUNTDOWN" && gameState.startTime && (
              <div className="text-6xl font-bold mt-4 animate-bounce">
                {Math.ceil((gameState.startTime - Date.now()) / 1000)}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE HUNTING STATE */}
        {(playerStatus === "HUNTING" || playerStatus === "DASHING") && (
          <>
            {/* Tag Stats - Always visible */}
            <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-orange-300">Your Tags</div>
                  <div className="text-3xl font-bold text-orange-400">{myTags}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-yellow-300">Team Total</div>
                  <div className="text-3xl font-bold text-yellow-400">{totalTags}</div>
                </div>
              </div>
            </div>

            {/* Coordination Hint */}
            {coordinationHint && uiMode !== "MINIMAL" && (
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3 text-center animate-pulse">
                <p className="text-sm font-bold text-blue-300">{coordinationHint}</p>
              </div>
            )}

            {/* Hunt Radar - Boat Positions */}
            {uiMode !== "MINIMAL" && nearbyBoats.length > 0 && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                <h3 className="text-sm font-bold text-green-300 mb-2 flex items-center gap-2">
                  🎯 Nearby Boats
                </h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {nearbyBoats.map((boat) => (
                    <div
                      key={boat.id}
                      className={`flex items-center justify-between text-sm rounded px-2 py-1 ${
                        boat.status === "ACTIVE"
                          ? "bg-green-800/40 border border-green-500/30"
                          : boat.status === "SAFE"
                          ? "bg-yellow-800/30 opacity-50"
                          : "bg-gray-800/30 opacity-30"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        <span>
                          {boat.status === "ACTIVE"
                            ? "🎯"
                            : boat.status === "SAFE"
                            ? "🛡️"
                            : "💀"}
                        </span>
                        <span className="truncate text-white/90">{boat.name}</span>
                      </div>
                      <span
                        className={`font-mono ml-2 ${
                          boat.status === "ACTIVE"
                            ? boat.distance < 100
                              ? "text-red-400 font-bold"
                              : "text-green-300"
                            : "text-gray-400"
                        }`}
                      >
                        {boat.distance}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distance to Safe Zone */}
            {distanceToSafeZone !== null && uiMode === "DETAILED" && (
              <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-300 flex items-center gap-2">
                    🎯 Safe Zone
                  </span>
                  <span className="text-lg font-mono font-bold text-purple-400">
                    {distanceToSafeZone}m
                  </span>
                </div>
                {distanceToSafeZone < 150 && (
                  <p className="text-xs text-purple-200 mt-1">Perfect blocking position!</p>
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
                color="#f97316" // Orange for swans
              />

              {/* Dash Button */}
              <button
                onClick={handleDashClick}
                disabled={!canDash}
                className={`relative w-32 h-32 rounded-full font-bold text-lg transition-all ${
                  isDashing
                    ? "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50 scale-110"
                    : canDash
                    ? "bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                {isDashing ? (
                  <>
                    <div className="text-3xl">💨</div>
                    <div className="text-xs mt-1">DASHING!</div>
                  </>
                ) : dashCooldown > 0 ? (
                  <>
                    <div className="text-2xl">⏱️</div>
                    <div className="text-xs mt-1">
                      {(dashCooldown / 1000).toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl">⚡</div>
                    <div className="text-xs mt-1">DASH</div>
                  </>
                )}

                {/* Cooldown circle overlay */}
                {dashCooldown > 0 && (
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
                        (1 - dashCooldown / 8000) * 283
                      } 283`}
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Instructions */}
            {uiMode === "DETAILED" && (
              <div className="mt-4 p-3 bg-slate-800/30 rounded-lg text-center">
                <p className="text-sm text-slate-200">
                  <span className="font-bold">Hunt down the blue boats!</span>
                  <br />
                  Use joystick/WASD to chase • Shift/Space to dash
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Team Stats Footer */}
      {gameState && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center bg-slate-800/30 rounded-lg p-2">
          <div>
            <div className="text-xs text-blue-300">Boats Active</div>
            <div className="text-xl font-bold text-blue-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "ACTIVE").length}
            </div>
          </div>
          <div>
            <div className="text-xs text-yellow-300">Boats Safe</div>
            <div className="text-xl font-bold text-yellow-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "SAFE").length}
            </div>
          </div>
          <div>
            <div className="text-xs text-red-300">Boats Tagged</div>
            <div className="text-xl font-bold text-red-400">
              {gameState.players.filter((p) => p.team === "BLUE" && p.status === "TAGGED").length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
