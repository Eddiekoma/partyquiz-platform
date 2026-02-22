"use client";

import type { SwanChaseGameState } from "@partyquiz/shared";

type OverlayVariant =
  | { type: "waiting"; countdown?: number }
  | { type: "tagged" }
  | { type: "safe" }
  | { type: "eliminated"; message?: string }
  | { type: "spectating"; playersAlive?: number };

interface GameEndOverlayProps {
  variant: OverlayVariant;
  playerName?: string;
}

/**
 * Full-screen overlay for non-active player states.
 *
 * Shown when the player is waiting, tagged, safe, or eliminated.
 * Replaces the per-mode implementations with one shared component.
 */
export function GameEndOverlay({ variant, playerName }: GameEndOverlayProps) {
  switch (variant.type) {
    case "waiting":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-6xl mb-4 animate-pulse">&#x23F3;</div>
          <p className="text-2xl font-bold mb-2 text-white">Get Ready!</p>
          <p className="text-white/60">Game starting soon...</p>
          {variant.countdown !== undefined && variant.countdown > 0 && (
            <div className="text-7xl font-black mt-6 animate-bounce text-white">
              {variant.countdown}
            </div>
          )}
        </div>
      );

    case "tagged":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-8xl mb-4">&#x1F4A5;</div>
          <p className="text-3xl font-bold text-red-400 mb-2">Tagged!</p>
          <p className="text-lg text-red-300">You were caught by a swan</p>
          <div className="mt-6 p-4 bg-red-900/50 rounded-xl">
            <p className="text-sm text-red-200">Watch the others escape!</p>
          </div>
        </div>
      );

    case "safe":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-8xl mb-4">&#x1F389;</div>
          <p className="text-3xl font-bold text-yellow-400 mb-2">Safe!</p>
          <p className="text-lg text-yellow-300">You reached the safe zone</p>
          <div className="mt-6 p-4 bg-yellow-900/50 rounded-xl">
            <p className="text-sm text-yellow-200">Wait for the game to end</p>
          </div>
        </div>
      );

    case "eliminated":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-8xl mb-4">&#x1F480;</div>
          <p className="text-3xl font-bold text-red-400 mb-2">Eliminated!</p>
          <p className="text-lg text-red-300">{variant.message || "You were caught"}</p>
          <div className="mt-6 p-4 bg-red-900/50 rounded-xl">
            <p className="text-sm text-red-200">Watch the remaining players battle it out!</p>
          </div>
        </div>
      );

    case "spectating":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-8xl mb-4">&#x1F440;</div>
          <p className="text-3xl font-bold text-white/80 mb-2">Spectating</p>
          {variant.playersAlive !== undefined && (
            <p className="text-lg text-white/60">{variant.playersAlive} players still alive</p>
          )}
        </div>
      );
  }
}
