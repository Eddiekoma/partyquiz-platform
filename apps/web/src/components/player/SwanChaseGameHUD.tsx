"use client";

import type { SwanChaseGameState } from "@partyquiz/shared";

interface SwanChaseGameHUDProps {
  gameState: SwanChaseGameState;
  /** Extra stats shown as columns in the top bar */
  stats?: Array<{
    label: string;
    value: string | number;
    color?: string; // tailwind text color class
  }>;
}

/**
 * Compact top HUD bar for all Swan Chase modes.
 *
 * Shows: timer (center) + mode-configurable stat columns.
 */
export function SwanChaseGameHUD({ gameState, stats }: SwanChaseGameHUDProps) {
  const seconds = Math.ceil(gameState.timeRemaining || 0);
  const isLow = seconds <= 10;

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2.5 mb-3">
      <div className={`flex items-center justify-between gap-2 ${stats && stats.length > 0 ? "" : "justify-center"}`}>
        {/* Left stats */}
        {stats && stats.length > 0 && (
          <div className="flex gap-3">
            {stats.slice(0, 2).map((s, i) => (
              <div key={i} className="text-center min-w-[40px]">
                <div className="text-[10px] uppercase tracking-wide opacity-60">{s.label}</div>
                <div className={`text-lg font-bold leading-tight ${s.color || "text-white"}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Center: Timer */}
        <div className={`text-center ${isLow ? "animate-pulse" : ""}`}>
          <div className={`text-2xl font-mono font-black tabular-nums ${
            isLow ? "text-red-400" : seconds <= 30 ? "text-yellow-400" : "text-white"
          }`}>
            {seconds}s
          </div>
        </div>

        {/* Right stats */}
        {stats && stats.length > 2 && (
          <div className="flex gap-3">
            {stats.slice(2, 4).map((s, i) => (
              <div key={i} className="text-center min-w-[40px]">
                <div className="text-[10px] uppercase tracking-wide opacity-60">{s.label}</div>
                <div className={`text-lg font-bold leading-tight ${s.color || "text-white"}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
