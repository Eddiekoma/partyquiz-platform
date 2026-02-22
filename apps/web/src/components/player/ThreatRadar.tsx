"use client";

import type { NearbyEntity } from "@/hooks/useSwanChaseControls";

interface ThreatRadarProps {
  entities: NearbyEntity[];
  /** Label for the section header */
  label?: string;
  /** Emoji prefix for the header */
  headerIcon?: string;
  /** Border/bg color theme */
  color?: "red" | "green" | "yellow" | "orange" | "purple";
  /** Max distance for "close" highlight */
  closeThreshold?: number;
  /** Show king crown icon */
  showKingBadge?: boolean;
}

const COLOR_MAP = {
  red: {
    bg: "bg-red-900/30",
    border: "border-red-500/50",
    header: "text-red-300",
    itemBg: "bg-red-800/30",
    closeTxt: "text-red-400",
    normalTxt: "text-red-300",
  },
  green: {
    bg: "bg-green-900/30",
    border: "border-green-500/50",
    header: "text-green-300",
    itemBg: "bg-green-800/40",
    closeTxt: "text-red-400",
    normalTxt: "text-green-300",
  },
  yellow: {
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/40",
    header: "text-yellow-300",
    itemBg: "bg-yellow-800/30",
    closeTxt: "text-red-400",
    normalTxt: "text-yellow-300",
  },
  orange: {
    bg: "bg-orange-900/30",
    border: "border-orange-500/50",
    header: "text-orange-300",
    itemBg: "bg-orange-800/30",
    closeTxt: "text-red-400",
    normalTxt: "text-orange-300",
  },
  purple: {
    bg: "bg-purple-900/30",
    border: "border-purple-500/50",
    header: "text-purple-300",
    itemBg: "bg-purple-800/30",
    closeTxt: "text-red-400",
    normalTxt: "text-purple-300",
  },
};

/**
 * Compact nearby-entity list shown during active gameplay.
 *
 * Used across all modes to show nearby swans, boats, or players.
 */
export function ThreatRadar({
  entities,
  label = "Nearby",
  headerIcon = "📡",
  color = "red",
  closeThreshold = 100,
  showKingBadge = false,
}: ThreatRadarProps) {
  if (entities.length === 0) return null;

  const c = COLOR_MAP[color];

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-3`}>
      <h3 className={`text-sm font-bold ${c.header} mb-2 flex items-center gap-1.5`}>
        {headerIcon} {label}
      </h3>
      <div className="space-y-1 max-h-28 overflow-y-auto">
        {entities.map((e) => (
          <div
            key={e.id}
            className={`flex items-center justify-between text-sm rounded px-2 py-1 ${
              e.isKing && showKingBadge
                ? "bg-yellow-800/40 border border-yellow-500/30"
                : c.itemBg
            }`}
          >
            <span className="truncate flex-1 text-white/90">
              {showKingBadge && e.isKing ? "👑 " : ""}
              {e.name}
            </span>
            <span
              className={`font-mono ml-2 ${
                e.distance < closeThreshold
                  ? `${c.closeTxt} font-bold`
                  : "opacity-75"
              }`}
            >
              {e.distance}m
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
