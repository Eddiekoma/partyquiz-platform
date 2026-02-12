"use client";

import { QuestionType } from "@partyquiz/shared";

interface QuestionTypeBadgeProps {
  type: QuestionType | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

// Human-readable labels and icons for each question type
// These are the 19 official question types from the editor
const QUESTION_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  // === TEXT QUESTIONS (7) ===
  MC_SINGLE: { icon: "🔘", label: "Multiple Choice", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  MC_MULTIPLE: { icon: "☑️", label: "Multiple Choice (Multi)", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  TRUE_FALSE: { icon: "✅", label: "True or False", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  OPEN_TEXT: { icon: "✏️", label: "Open Text", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  ESTIMATION: { icon: "🎯", label: "Estimation", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  ORDER: { icon: "📊", label: "Put in Order", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  POLL: { icon: "�", label: "Poll", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },

  // === PHOTO QUESTIONS (2) ===
  PHOTO_QUESTION: { icon: "📷", label: "Photo Question", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
  PHOTO_OPEN: { icon: "📷", label: "Photo Open", color: "bg-pink-500/20 text-pink-300 border-pink-500/40" },

  // === AUDIO QUESTIONS (2) ===
  AUDIO_QUESTION: { icon: "🔊", label: "Audio Question", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  AUDIO_OPEN: { icon: "🔊", label: "Audio Open", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },

  // === VIDEO QUESTIONS (2) ===
  VIDEO_QUESTION: { icon: "🎬", label: "Video Question", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  VIDEO_OPEN: { icon: "🎬", label: "Video Open", color: "bg-red-500/20 text-red-300 border-red-500/40" },

  // === SPOTIFY MUSIC (3) ===
  MUSIC_GUESS_TITLE: { icon: "🎵", label: "Guess the Song", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  MUSIC_GUESS_ARTIST: { icon: "🎤", label: "Guess the Artist", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  MUSIC_GUESS_YEAR: { icon: "📅", label: "Guess the Year", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },

  // === YOUTUBE VIDEOS (3) ===
  YOUTUBE_SCENE_QUESTION: { icon: "▶️", label: "Video Scene", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  YOUTUBE_NEXT_LINE: { icon: "💬", label: "Next Line", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  YOUTUBE_WHO_SAID_IT: { icon: "🗣️", label: "Who Said It?", color: "bg-red-500/20 text-red-300 border-red-500/40" },
};

const DEFAULT_CONFIG = { icon: "❓", label: "Question", color: "bg-slate-500/20 text-slate-300 border-slate-500/40" };

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
  return QUESTION_TYPE_CONFIG[type]?.icon || "❓";
}
