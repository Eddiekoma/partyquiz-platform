"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { AbilityButton } from "./AbilityButton";
import { SwanChaseGameHUD } from "./SwanChaseGameHUD";
import { GameEndOverlay } from "./GameEndOverlay";
import type { SwanChaseGameState } from "@partyquiz/shared";
import { SwanChasePlayerStatus } from "@partyquiz/shared";

interface RaceControlsProps {
  sessionCode: string;
  playerId: string;
  gameState: SwanChaseGameState | null;
  onStroke: (duration: number) => void;
  onSprint: () => void;
  socket: any;
}

/**
 * Player controls for RACE mode.
 *
 * Uses tap-and-hold stroke mechanics instead of a joystick.
 * Hold the paddle button to build power, release to stroke.
 */
export function RaceControls({
  sessionCode: _sessionCode,
  playerId,
  gameState,
  onStroke,
  onSprint,
  socket: _socket,
}: RaceControlsProps) {
  const [strokeStart, setStrokeStart] = useState<number | null>(null);
  const [strokePower, setStrokePower] = useState(0); // 0..1 visual power
  const animFrameRef = useRef<number | undefined>(undefined);
  const onStrokeRef = useRef(onStroke);
  useEffect(() => { onStrokeRef.current = onStroke; }, [onStroke]);

  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const isActive = myPlayer?.status === SwanChasePlayerStatus.ACTIVE;
  const isFinished = myPlayer?.status === SwanChasePlayerStatus.SAFE;

  // Sprint cooldown
  const [sprintCooldownMs, setSprintCooldownMs] = useState(0);
  const sprintActive = myPlayer?.abilities.sprint?.active ?? false;

  useEffect(() => {
    if (!myPlayer?.abilities.sprint) return;
    const cooldownUntil = myPlayer.abilities.sprint.cooldownUntil || 0;
    const remaining = Math.max(0, cooldownUntil - Date.now());
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

  const sprintAbility = useMemo(
    () => ({
      ready: sprintCooldownMs === 0 && !sprintActive && isActive,
      active: sprintActive,
      cooldownMs: sprintCooldownMs,
      cooldownFraction: sprintCooldownMs / 3000,
      charges: myPlayer?.abilities.sprint?.charges ?? 0,
    }),
    [sprintCooldownMs, sprintActive, isActive, myPlayer?.abilities.sprint?.charges]
  );

  // Animate stroke power bar while holding
  useEffect(() => {
    if (strokeStart === null) {
      setStrokePower(0);
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - strokeStart;
      const power = Math.min(elapsed / 300, 1); // 300ms = full power
      setStrokePower(power);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [strokeStart]);

  // Stroke handlers
  const handleStrokeStart = useCallback(() => {
    if (!isActive) return;
    setStrokeStart(Date.now());
  }, [isActive]);

  const handleStrokeEnd = useCallback(() => {
    if (strokeStart === null) return;
    const duration = Date.now() - strokeStart;
    setStrokeStart(null);
    onStrokeRef.current(duration);
  }, [strokeStart]);

  // Keyboard support: Space = stroke
  useEffect(() => {
    if (!isActive) return;

    let spaceDown = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " && !spaceDown) {
        e.preventDefault();
        spaceDown = true;
        handleStrokeStart();
      }
      if (e.key === "Shift" && sprintAbility.ready) {
        e.preventDefault();
        onSprint();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && spaceDown) {
        spaceDown = false;
        handleStrokeEnd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isActive, handleStrokeStart, handleStrokeEnd, sprintAbility.ready, onSprint]);

  // Calculate progress
  const progress = useMemo(() => {
    if (!myPlayer || !gameState) return 0;
    // Position runs from ~100 (start) to ~1500 (finish)
    const startX = 100;
    const finishX = 1500;
    const x = myPlayer.position.x;
    return Math.min(1, Math.max(0, (x - startX) / (finishX - startX)));
  }, [myPlayer, gameState]);

  const finishPosition = useMemo(() => {
    if (!gameState || !isFinished) return null;
    // Count players with SAFE status who have higher x position (finished before us)
    // Actually the score encodes position: 10=1st, 8=2nd, 6=3rd, etc.
    const score = myPlayer?.score ?? 0;
    if (score >= 10) return 1;
    if (score >= 8) return 2;
    if (score >= 6) return 3;
    return Math.max(1, Math.round((10 - score) / 2) + 1);
  }, [gameState, isFinished, myPlayer?.score]);

  // Overlay
  const overlayVariant = useMemo(() => {
    if (!gameState || !myPlayer) return { type: "waiting" as const };
    if (gameState.status === "COUNTDOWN") {
      const countdown = gameState.startTime
        ? Math.ceil((gameState.startTime - Date.now()) / 1000)
        : undefined;
      return { type: "waiting" as const, countdown };
    }
    return null;
  }, [gameState, myPlayer]);

  // HUD stats
  const hudStats = useMemo(() => {
    if (!gameState) return [];
    const finished = gameState.players.filter((p) => p.status === SwanChasePlayerStatus.SAFE).length;
    return [
      { label: "Finished", value: `${finished}/${gameState.players.length}`, color: "text-green-400" },
      { label: "Progress", value: `${Math.round(progress * 100)}%`, color: "text-blue-400" },
    ];
  }, [gameState, progress]);

  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

  return (
    <div
      className={`flex flex-col h-full text-white p-4 ${
        isFinished
          ? "bg-gradient-to-b from-green-900 to-emerald-950"
          : "bg-gradient-to-b from-cyan-900 to-cyan-950"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">&#x1F6A3;</div>
          <div>
            <h2 className="text-lg font-bold">Swan Race</h2>
            <p className="text-sm opacity-75">{myPlayer?.name || "Player"}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full font-bold text-xs ${
            isFinished
              ? "bg-green-500"
              : isActive
              ? "bg-cyan-500 animate-pulse"
              : "bg-gray-500"
          }`}
        >
          {isFinished
            ? `${finishPosition ? medals[finishPosition - 1] || "" : ""} #${finishPosition}`
            : isActive
            ? "RACING"
            : "WAIT"}
        </div>
      </div>

      {/* HUD */}
      {gameState && <SwanChaseGameHUD gameState={gameState} stats={hudStats} />}

      {/* Content */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {overlayVariant ? (
          <GameEndOverlay variant={overlayVariant} playerName={myPlayer?.name} />
        ) : isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="text-8xl mb-4">
              {finishPosition && finishPosition <= 3
                ? medals[finishPosition - 1]
                : "\u{1F3C1}"}
            </div>
            <p className="text-3xl font-bold text-green-400 mb-2">
              {finishPosition === 1
                ? "You Won!"
                : `${finishPosition}${finishPosition === 2 ? "nd" : finishPosition === 3 ? "rd" : "th"} Place`}
            </p>
            <p className="text-lg text-green-300">
              +{myPlayer?.score || 0} points
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="bg-black/30 rounded-full h-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-150 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(5, progress * 100)}%` }}
              >
                <span className="text-xs font-bold">{Math.round(progress * 100)}%</span>
              </div>
            </div>

            {/* Stroke power indicator */}
            {strokeStart !== null && (
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-yellow-300 mb-1">Power</div>
                <div className="bg-black/30 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      strokePower >= 0.9
                        ? "bg-red-500"
                        : strokePower >= 0.6
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${strokePower * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-4 items-center justify-center mt-auto pt-4">
              {/* Main stroke button */}
              <button
                onMouseDown={handleStrokeStart}
                onMouseUp={handleStrokeEnd}
                onMouseLeave={() => strokeStart !== null && handleStrokeEnd()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleStrokeStart();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleStrokeEnd();
                }}
                disabled={!isActive}
                className={`relative w-44 h-44 rounded-full font-bold text-lg transition-all select-none touch-none ${
                  strokeStart !== null
                    ? "bg-yellow-500 scale-95 shadow-inner shadow-yellow-600/50"
                    : isActive
                    ? "bg-cyan-500 hover:bg-cyan-600 active:scale-95 shadow-xl shadow-cyan-500/30"
                    : "bg-gray-600 cursor-not-allowed opacity-50"
                }`}
              >
                <div className="text-5xl">&#x1F6A3;</div>
                <div className="text-sm mt-1">
                  {strokeStart !== null ? "RELEASE!" : "HOLD TO PADDLE"}
                </div>

                {/* Power ring while holding */}
                {strokeStart !== null && (
                  <svg
                    className="absolute inset-0 -rotate-90 pointer-events-none"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke={strokePower >= 0.9 ? "#ef4444" : strokePower >= 0.6 ? "#eab308" : "#22c55e"}
                      strokeWidth="5"
                      strokeDasharray={`${strokePower * 289} 289`}
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>

              {/* Sprint button */}
              <AbilityButton
                ability={sprintAbility}
                onClick={onSprint}
                label="SPRINT"
                activeLabel="BOOST!"
                icon="&#x1F680;"
                activeIcon="&#x26A1;"
                size={96}
              />
            </div>

            {/* Instructions */}
            <div className="mt-3 p-2.5 bg-black/20 rounded-lg text-center">
              <p className="text-xs opacity-75">
                <span className="font-bold">Hold &amp; release to paddle!</span>
                <br />
                Longer holds = more power &bull; Shift to sprint
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
