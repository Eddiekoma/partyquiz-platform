"use client";

import { useState } from "react";
import type { QuestionType } from "@partyquiz/shared";

interface AnswerInputProps {
  questionType: QuestionType | string; // Allow string for database types
  options?: Array<{ id: string; text: string }>;
  settingsJson?: any;
  onSubmit: (answer: any) => void;
  disabled?: boolean;
}

export function AnswerInput({
  questionType,
  options,
  settingsJson,
  onSubmit,
  disabled = false,
}: AnswerInputProps) {
  const [answer, setAnswer] = useState<any>(null);

  const handleSubmit = () => {
    if (!answer || disabled) return;
    onSubmit(answer);
  };

  // Multiple Choice Question (handles both MCQ and MC_SINGLE/MC_MULTIPLE from database)
  if (questionType === "MCQ" || questionType === "MC_SINGLE" || questionType === "MC_MULTIPLE") {
    const isMultiple = settingsJson?.allowMultiple || questionType === "MC_MULTIPLE";

    if (isMultiple) {
      return (
        <MultipleChoiceMultiple
          options={options || []}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    }

    return (
      <div className="space-y-3">
        {options?.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              setAnswer(option.id);
              setTimeout(() => onSubmit(option.id), 100);
            }}
            disabled={disabled}
            className="w-full p-4 text-lg font-bold text-white bg-slate-800/20 backdrop-blur-sm rounded-xl hover:bg-slate-800/30 active:scale-95 transition-all disabled:opacity-50"
          >
            {option.text}
          </button>
        ))}
      </div>
    );
  }

  // True/False
  if (questionType === "TRUE_FALSE") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setAnswer(true);
            setTimeout(() => onSubmit(true), 100);
          }}
          disabled={disabled}
          className="p-6 text-2xl font-black text-white bg-green-500/80 backdrop-blur-sm rounded-2xl hover:bg-green-600/80 active:scale-95 transition-all disabled:opacity-50"
        >
          ✅ TRUE
        </button>
        <button
          onClick={() => {
            setAnswer(false);
            setTimeout(() => onSubmit(false), 100);
          }}
          disabled={disabled}
          className="p-6 text-2xl font-black text-white bg-red-500/80 backdrop-blur-sm rounded-2xl hover:bg-red-600/80 active:scale-95 transition-all disabled:opacity-50"
        >
          ❌ FALSE
        </button>
      </div>
    );
  }

  // Open Text Question (handles both OPEN and OPEN_TEXT from database)
  if (questionType === "OPEN" || questionType === "OPEN_TEXT") {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={disabled}
          className="w-full px-6 py-4 text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Ordering Question (handles both ORDERING and ORDER from database)
  if (questionType === "ORDERING" || questionType === "ORDER") {
    return (
      <OrderingInput
        options={options || []}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Photo questions (all use text input) - handles database types too
  if (
    questionType === "PHOTO_GUESS" ||
    questionType === "PHOTO_ZOOM_REVEAL" ||
    questionType === "PHOTO_QUESTION" ||
    questionType === "PHOTO_OPEN"
  ) {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What do you see?"
          disabled={disabled}
          className="w-full px-6 py-4 text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Photo Timeline (uses ordering of photo IDs)
  if (questionType === "PHOTO_TIMELINE") {
    return (
      <OrderingInput
        options={options || []}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Music Title/Artist (text input)
  if (
    questionType === "MUSIC_GUESS_TITLE" ||
    questionType === "MUSIC_GUESS_ARTIST"
  ) {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={
            questionType === "MUSIC_GUESS_TITLE"
              ? "Song title..."
              : "Artist name..."
          }
          disabled={disabled}
          className="w-full px-6 py-4 text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Music Year or Estimation (number input)
  if (questionType === "MUSIC_GUESS_YEAR" || questionType === "ESTIMATION") {
    return (
      <div className="space-y-4">
        <input
          type="number"
          value={answer || ""}
          onChange={(e) => setAnswer(parseInt(e.target.value) || "")}
          placeholder="Year (e.g., 1985)"
          disabled={disabled}
          min={1900}
          max={2100}
          className="w-full px-6 py-4 text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer}
          className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Music Timeline (ordering)
  if (questionType === "MUSIC_HITSTER_TIMELINE") {
    return (
      <OrderingInput
        options={options || []}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Music Older/Newer (binary choice)
  if (questionType === "MUSIC_OLDER_NEWER_THAN") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setAnswer("older");
            setTimeout(() => onSubmit("older"), 100);
          }}
          disabled={disabled}
          className="p-6 text-2xl font-black text-white bg-blue-500/80 backdrop-blur-sm rounded-2xl hover:bg-blue-600/80 active:scale-95 transition-all disabled:opacity-50"
        >
          ⏪ OLDER
        </button>
        <button
          onClick={() => {
            setAnswer("newer");
            setTimeout(() => onSubmit("newer"), 100);
          }}
          disabled={disabled}
          className="p-6 text-2xl font-black text-white bg-orange-500/80 backdrop-blur-sm rounded-2xl hover:bg-orange-600/80 active:scale-95 transition-all disabled:opacity-50"
        >
          ⏩ NEWER
        </button>
      </div>
    );
  }

  // YouTube questions (text input)
  if (
    questionType === "YOUTUBE_SCENE_QUESTION" ||
    questionType === "YOUTUBE_NEXT_LINE" ||
    questionType === "YOUTUBE_WHO_SAID_IT"
  ) {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={disabled}
          className="w-full px-6 py-4 text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Poll (radio buttons)
  if (questionType === "POLL") {
    return (
      <div className="space-y-3">
        {options?.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              setAnswer(option.id);
              setTimeout(() => onSubmit(option.id), 100);
            }}
            disabled={disabled}
            className="w-full p-4 text-lg font-bold text-white bg-slate-800/20 backdrop-blur-sm rounded-xl hover:bg-slate-800/30 active:scale-95 transition-all disabled:opacity-50"
          >
            {option.text}
          </button>
        ))}
      </div>
    );
  }

  // Emoji Vote (emoji selector)
  if (questionType === "EMOJI_VOTE") {
    const emojis = settingsJson?.emojis || ["👍", "👎", "❤️", "😂", "😮"];
    return (
      <div className="grid grid-cols-5 gap-3">
        {emojis.map((emoji: string) => (
          <button
            key={emoji}
            onClick={() => {
              setAnswer(emoji);
              setTimeout(() => onSubmit(emoji), 100);
            }}
            disabled={disabled}
            className="aspect-square text-5xl bg-slate-800/20 backdrop-blur-sm rounded-2xl hover:bg-slate-800/30 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  // Chaos Event (game input)
  if (questionType === "CHAOS_EVENT") {
    return (
      <button
        onClick={() => {
          const input = Math.random(); // Random game input
          setAnswer(input);
          onSubmit(input);
        }}
        disabled={disabled}
        className="w-full py-8 text-3xl font-black text-white bg-gradient-to-r from-red-600 via-yellow-500 to-purple-600 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 animate-pulse"
      >
        🎮 TAP TO PLAY!
      </button>
    );
  }

  // Default fallback - show the type for debugging
  console.warn("[AnswerInput] Unsupported question type:", questionType);
  return (
    <div className="text-center text-white/60 py-8">
      <p>Question type not supported yet</p>
      <p className="text-xs opacity-50 mt-2">Type: {questionType}</p>
    </div>
  );
}

// Multi-select MCQ component
function MultipleChoiceMultiple({
  options,
  onSubmit,
  disabled,
}: {
  options: Array<{ id: string; text: string }>;
  onSubmit: (answer: any) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleOption = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => toggleOption(option.id)}
            disabled={disabled}
            className={`w-full p-4 text-lg font-bold text-white rounded-xl transition-all disabled:opacity-50 ${
              selected.includes(option.id)
                ? "bg-purple-600 ring-4 ring-purple-300"
                : "bg-slate-800/20 backdrop-blur-sm hover:bg-slate-800/30"
            }`}
          >
            {selected.includes(option.id) ? "✅ " : ""}
            {option.text}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSubmit(selected)}
        disabled={disabled || selected.length === 0}
        className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
      >
        Submit ({selected.length} selected)
      </button>
    </div>
  );
}

// Ordering component with drag-and-drop
function OrderingInput({
  options,
  onSubmit,
  disabled,
}: {
  options: Array<{ id: string; text: string }>;
  onSubmit: (answer: any) => void;
  disabled: boolean;
}) {
  const [items, setItems] = useState(options);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-white/80 font-bold mb-4">
        Order from first to last:
      </p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2 bg-slate-800/20 backdrop-blur-sm rounded-xl p-3"
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={disabled || index === 0}
                className="p-1 text-white bg-slate-800/20 rounded hover:bg-slate-800/30 disabled:opacity-30 transition-all"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={disabled || index === items.length - 1}
                className="p-1 text-white bg-slate-800/20 rounded hover:bg-slate-800/30 disabled:opacity-30 transition-all"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 font-bold text-white">
              {index + 1}. {item.text}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onSubmit(items.map((item) => item.id))}
        disabled={disabled}
        className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
      >
        Submit Order
      </button>
    </div>
  );
}
