"use client";

import type { QuestionType } from "@partyquiz/shared";

interface QuestionTypeBadgeProps {
  type: QuestionType | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

// Human-readable labels and icons for each question type
// These are the 24 official question types from the editor
// Icons chosen to be visually distinct and descriptive of the interaction type
const QUESTION_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  // === TEXT QUESTIONS (7) ===
  MC_SINGLE:   { icon: "\u{1F518}", label: "Multiple Choice",        color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  MC_MULTIPLE: { icon: "\u2611\uFE0F", label: "Multiple Choice (Multi)", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" },
  MC_ORDER:    { icon: "\u{1F522}", label: "Put in Order",           color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  TRUE_FALSE:  { icon: "\u2696\uFE0F", label: "True/False",         color: "bg-green-500/20 text-green-300 border-green-500/40" },
  OPEN_TEXT:   { icon: "\u270F\uFE0F", label: "Open Text",          color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  NUMERIC:     { icon: "\u{1F51F}", label: "Numeric",               color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  SLIDER:      { icon: "\u{1F39A}\uFE0F", label: "Slider",          color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },

  // Legacy aliases (deprecated but kept for backward compatibility)
  ESTIMATION:  { icon: "\u{1F3AF}", label: "Estimation",            color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  ORDER:       { icon: "\u{1F522}", label: "Put in Order",           color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  POLL:        { icon: "\u{1F4CA}", label: "Poll",                   color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },

  // === PHOTO QUESTIONS (7) ===
  PHOTO_MC_SINGLE:   { icon: "\u{1F4F7}", label: "Photo MC",         color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_MC_MULTIPLE: { icon: "\u{1F4F8}", label: "Photo MC (Multi)", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_MC_ORDER:    { icon: "\u{1F5BC}\uFE0F", label: "Photo Order", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_TRUE_FALSE:  { icon: "\u{1F4F7}", label: "Photo True/False", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_OPEN_TEXT:   { icon: "\u{1F4F7}", label: "Photo Open",       color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_NUMERIC:     { icon: "\u{1F4F7}", label: "Photo Numeric",    color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_SLIDER:      { icon: "\u{1F4F7}", label: "Photo Slider",     color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },

  // === AUDIO QUESTIONS (2) ===
  AUDIO_QUESTION: { icon: "\u{1F50A}", label: "Audio Question", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  AUDIO_OPEN:     { icon: "\u{1F3A7}", label: "Audio Open",     color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },

  // === VIDEO QUESTIONS (2) ===
  VIDEO_QUESTION: { icon: "\u{1F3AC}", label: "Video Question", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  VIDEO_OPEN:     { icon: "\u{1F4F9}", label: "Video Open",     color: "bg-red-500/20 text-red-300 border-red-500/40" },

  // === SPOTIFY MUSIC (3) ===
  MUSIC_GUESS_TITLE:  { icon: "\u{1F3B5}", label: "Guess the Song",   color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  MUSIC_GUESS_ARTIST: { icon: "\u{1F3A4}", label: "Guess the Artist", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  MUSIC_GUESS_YEAR:   { icon: "\u{1F4C5}", label: "Guess the Year",   color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },

  // === YOUTUBE VIDEOS (3) ===
  YOUTUBE_SCENE_QUESTION: { icon: "\u25B6\uFE0F", label: "Video Scene",   color: "bg-red-500/20 text-red-300 border-red-500/40" },
  YOUTUBE_NEXT_LINE:      { icon: "\u{1F4AC}", label: "Next Line",        color: "bg-red-500/20 text-red-300 border-red-500/40" },
  YOUTUBE_WHO_SAID_IT:    { icon: "\u{1F5E3}\uFE0F", label: "Who Said It?", color: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const DEFAULT_CONFIG = { icon: "\u2753", label: "Question", color: "bg-slate-500/20 text-slate-300 border-slate-500/40" };

export function QuestionTypeBadge({ type, size = "md", showLabel = true }: QuestionTypeBadgeProps) {
  const config = QUESTION_TYPE_CONFIG[type] || DEFAULT_CONFIG;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  const iconSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border font-semibold ${config.color} ${sizeClasses[size]}`}
    >
      <span className={iconSizes[size]}>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

// Helper function to get just the label
export function getQuestionTypeLabel(type: QuestionType | string): string {
  return QUESTION_TYPE_CONFIG[type]?.label || "Question";
}

// Helper function to get just the icon
export function getQuestionTypeIcon(type: QuestionType | string): string {
  return QUESTION_TYPE_CONFIG[type]?.icon || "\u2753";
}
