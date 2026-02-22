"use client";

import type { AbilityCooldown } from "@/hooks/useSwanChaseControls";

interface AbilityButtonProps {
  ability: AbilityCooldown;
  onClick: () => void;
  /** Label shown when ready */
  label: string;
  /** Label shown when ability is active */
  activeLabel?: string;
  /** Color classes when ready (default: green) */
  readyColor?: string;
  /** Color classes when active (default: yellow pulse) */
  activeColor?: string;
  /** Size in px (default: 96) */
  size?: number;
  /** Icon shown when ready */
  icon: string;
  /** Icon shown when active */
  activeIcon?: string;
}

/**
 * Reusable ability button with SVG cooldown ring.
 *
 * Used for Sprint and Dash across all game modes.
 */
export function AbilityButton({
  ability,
  onClick,
  label,
  activeLabel,
  readyColor = "bg-green-500 hover:bg-green-600 active:scale-95 shadow-lg",
  activeColor = "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50",
  size = 96,
  icon,
  activeIcon,
}: AbilityButtonProps) {
  const handleClick = () => {
    if (ability.ready) onClick();
  };

  const sizeClass = `w-[${size}px] h-[${size}px]`;

  return (
    <button
      onClick={handleClick}
      disabled={!ability.ready && !ability.active}
      className={`relative rounded-full font-bold text-sm transition-all flex flex-col items-center justify-center ${
        ability.active
          ? activeColor
          : ability.ready
          ? readyColor
          : "bg-gray-600 cursor-not-allowed opacity-50"
      }`}
      style={{ width: size, height: size }}
    >
      {ability.active ? (
        <>
          <div className="text-2xl">{activeIcon || icon}</div>
          <div className="text-xs mt-0.5">{activeLabel || label}</div>
        </>
      ) : ability.cooldownMs > 0 ? (
        <>
          <div className="text-xl">&#x23F1;&#xFE0F;</div>
          <div className="text-xs mt-0.5">{(ability.cooldownMs / 1000).toFixed(1)}s</div>
        </>
      ) : (
        <>
          <div className="text-2xl">{icon}</div>
          <div className="text-xs mt-0.5">{label}</div>
        </>
      )}

      {/* SVG cooldown ring */}
      {ability.cooldownMs > 0 && (
        <svg
          className="absolute inset-0 -rotate-90 pointer-events-none"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="4"
            strokeDasharray={`${(1 - ability.cooldownFraction) * 283} 283`}
          />
        </svg>
      )}
    </button>
  );
}
