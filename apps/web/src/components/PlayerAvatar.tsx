"use client";

import { useMemo } from "react";

// ============================================================================
// DiceBear Avatar System for PartyQuiz
// ============================================================================
// Uses the DiceBear HTTP API to generate unique, fun avatars for players.
// No npm packages needed - pure URL-based SVG generation.
//
// Avatar format stored in DB: "{style}:{seed}" e.g. "adventurer:abc123"
// Legacy emoji format still supported for backward compatibility.
// ============================================================================

/** All available DiceBear styles - fun, colorful character styles perfect for a party game */
export const AVATAR_STYLES = [
  "adventurer",       // Cute cartoon characters with various features
  "avataaars",        // Human-like avatars with clothes, hair, accessories
  "big-smile",        // Big smiling faces with fun accessories
  "bottts",           // Cute robots with antennas and visors
  "croodles",         // Doodle-style hand-drawn characters
  "fun-emoji",        // Colorful emoji-style faces
  "lorelei",          // Stylized artistic faces
  "micah",            // Simple but expressive characters
  "miniavs",          // Mini avatar characters
  "notionists",       // Notion-style illustrated people
  "open-peeps",       // Pablo Stanley's open source people illustrations
  "personas",         // Character personas with various outfits
  "pixel-art",        // Retro pixel art characters
  "thumbs",           // Thumbs-up style avatars
  "dylan",            // Dylan-style illustrated characters
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

/** Generate a DiceBear avatar URL from a style:seed string */
export function getAvatarUrl(avatar: string | null | undefined, size = 64): string | null {
  if (!avatar) return null;
  
  // Legacy emoji detection (emoji characters are typically 1-4 chars or have specific Unicode ranges)
  if (!avatar.includes(":")) return null; // It's an emoji, not a DiceBear avatar
  
  const [style, seed] = avatar.split(":", 2);
  if (!style || !seed) return null;
  
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}&radius=50`;
}

/** Check if an avatar string is a DiceBear avatar (vs legacy emoji) */
export function isDiceBearAvatar(avatar: string | null | undefined): boolean {
  return !!avatar && avatar.includes(":");
}

/** Generate a random unique avatar string (style:seed format) */
export function generateRandomAvatar(excludeAvatars: string[] = []): string {
  const excludeSeeds = new Set(excludeAvatars.map(a => a));
  
  // Pick a random style
  const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
  
  // Generate a unique seed (using timestamp + random to ensure uniqueness)
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  
  const avatar = `${style}:${seed}`;
  
  // Extremely unlikely collision, but just in case
  if (excludeSeeds.has(avatar)) {
    return generateRandomAvatar(excludeAvatars);
  }
  
  return avatar;
}

/** Shuffle to a new random avatar, guaranteed different from current and excluded ones */
export function shuffleAvatar(currentAvatar: string, excludeAvatars: string[] = []): string {
  // Always generate a completely new one
  return generateRandomAvatar([currentAvatar, ...excludeAvatars]);
}

// ============================================================================
// React Component
// ============================================================================

interface PlayerAvatarProps {
  avatar: string | null | undefined;
  size?: number;
  className?: string;
  /** If true, applies grayscale filter (for offline/left players) */
  grayscale?: boolean;
}

/**
 * Renders a player avatar. Handles both:
 * - Legacy emoji avatars (rendered as text)
 * - DiceBear avatars (rendered as SVG images)
 */
export function PlayerAvatar({ avatar, size = 48, className = "", grayscale = false }: PlayerAvatarProps) {
  const avatarUrl = useMemo(() => getAvatarUrl(avatar, size * 2), [avatar, size]);
  
  const grayscaleClass = grayscale ? "grayscale" : "";
  
  // DiceBear avatar - render as image
  if (avatarUrl) {
    return (
      <img 
        src={avatarUrl}
        alt="Player avatar"
        width={size}
        height={size}
        className={`rounded-full bg-white/10 ${grayscaleClass} ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        loading="lazy"
      />
    );
  }
  
  // Legacy emoji or fallback
  const emoji = avatar || "👤";
  const fontSize = size * 0.65;
  
  return (
    <span 
      className={`inline-flex items-center justify-center ${grayscaleClass} ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, fontSize }}
      role="img"
      aria-label="Player avatar"
    >
      {emoji}
    </span>
  );
}

// ============================================================================
// Avatar Picker Component (for join page)
// ============================================================================

interface AvatarPickerProps {
  /** Currently selected avatar string */
  value: string;
  /** Called when player shuffles or picks a new avatar */
  onChange: (avatar: string) => void;
  /** Avatars already taken by other players in the session */
  takenAvatars?: string[];
}

/**
 * Avatar picker with shuffle button.
 * Shows a large preview of the current avatar with a shuffle button.
 */
export function AvatarPicker({ value, onChange, takenAvatars = [] }: AvatarPickerProps) {
  const handleShuffle = () => {
    const newAvatar = shuffleAvatar(value, takenAvatars);
    onChange(newAvatar);
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      {/* Large avatar preview */}
      <div className="relative group">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-lg ring-3 sm:ring-4 ring-purple-200 overflow-hidden transition-transform group-hover:scale-105">
          <PlayerAvatar avatar={value} size={88} className="sm:hidden" />
          <PlayerAvatar avatar={value} size={120} className="hidden sm:block" />
        </div>

        {/* Shuffle overlay on hover/tap */}
        <button
          type="button"
          onClick={handleShuffle}
          className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:opacity-100 active:bg-black/30"
          title="Shuffle avatar"
        >
          <span className="text-3xl sm:text-4xl drop-shadow-lg">🔀</span>
        </button>
      </div>

      {/* Shuffle button */}
      <button
        type="button"
        onClick={handleShuffle}
        className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-300 text-purple-700 font-bold rounded-full transition-all transform hover:scale-105 active:scale-95 text-sm sm:text-base"
      >
        <span className="text-lg sm:text-xl">🔀</span>
        <span>Shuffle Avatar</span>
      </button>

      <p className="text-xs text-gray-400 text-center px-4">
        Each avatar is unique — keep shuffling until you find your favorite!
      </p>
    </div>
  );
}
