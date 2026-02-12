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

  // Multiple Choice Question - MC_SINGLE (single answer) or MC_MULTIPLE (multiple answers)
  if (questionType === "MC_SINGLE" || questionType === "MC_MULTIPLE") {
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

  // Open Text Question - OPEN_TEXT
  if (questionType === "OPEN_TEXT") {
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

  // Ordering Question - ORDER
  if (questionType === "ORDER") {
    return (
      <OrderingInput
        options={options || []}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Photo questions - PHOTO_QUESTION (MCQ with photo) and PHOTO_OPEN (open answer)
  if (
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

  // Audio questions - AUDIO_QUESTION (MCQ with audio) and AUDIO_OPEN (open answer)
  if (
    questionType === "AUDIO_QUESTION" ||
    questionType === "AUDIO_OPEN"
  ) {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What do you hear?"
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

  // Video questions - VIDEO_QUESTION (MCQ with video) and VIDEO_OPEN (open answer)
  if (
    questionType === "VIDEO_QUESTION" ||
    questionType === "VIDEO_OPEN"
  ) {
    return (
      <div className="space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What did you see?"
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

  // Spotify Music Title/Artist (text input) - MUSIC_GUESS_TITLE, MUSIC_GUESS_ARTIST
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

  // Spotify Music Year or Estimation (number input) - MUSIC_GUESS_YEAR, ESTIMATION
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

  // YouTube questions (text input) - YOUTUBE_SCENE_QUESTION, YOUTUBE_NEXT_LINE, YOUTUBE_WHO_SAID_IT
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

  // Poll - POLL (shows options like MC_SINGLE but without scoring)
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
              {item.text}
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
