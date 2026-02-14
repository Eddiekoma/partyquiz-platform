"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuestionType } from "@partyquiz/shared";
import { requiresPhotos, getBaseQuestionType } from "@partyquiz/shared";

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
  // PHOTO_MC_SINGLE / PHOTO_MC_MULTIPLE work identically — just with photos displayed above
  if (questionType === "MC_SINGLE" || questionType === "MC_MULTIPLE" ||
      questionType === "PHOTO_MC_SINGLE" || questionType === "PHOTO_MC_MULTIPLE") {
    const isMultiple = settingsJson?.allowMultiple || questionType === "MC_MULTIPLE" || questionType === "PHOTO_MC_MULTIPLE";

    if (isMultiple) {
      return (
        <MultipleChoiceMultiple
          options={options || []}
          onSubmit={onSubmit}
          disabled={disabled}
        />
      );
    }

    // MC_SINGLE: Select first, then submit
    return (
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-2 md:space-y-3">
          {options?.map((option) => (
            <button
              key={option.id}
              onClick={() => setAnswer(option.id)}
              disabled={disabled}
              className={`w-full p-4 md:p-5 min-h-[52px] text-base md:text-lg font-bold text-white rounded-xl active:scale-95 transition-all disabled:opacity-50 ${
                answer === option.id
                  ? "bg-purple-600 ring-4 ring-purple-400 scale-[1.02]"
                  : "bg-slate-800/20 backdrop-blur-sm hover:bg-slate-800/30"
              }`}
            >
              {option.text}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSubmit(answer)}
          disabled={disabled || !answer}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50 disabled:from-gray-500 disabled:to-gray-600"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // True/False - Select first, then submit
  // PHOTO_TRUE_FALSE works identically — just with photos displayed above
  if (questionType === "TRUE_FALSE" || questionType === "PHOTO_TRUE_FALSE") {
    return (
      <div className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <button
            onClick={() => setAnswer(true)}
            disabled={disabled}
            className={`p-5 md:p-6 text-xl md:text-2xl font-black text-white rounded-2xl active:scale-95 transition-all disabled:opacity-50 ${
              answer === true
                ? "bg-green-600 ring-4 ring-green-400 scale-[1.02]"
                : "bg-green-500/80 backdrop-blur-sm hover:bg-green-600/80"
            }`}
          >
            ✅ TRUE
          </button>
          <button
            onClick={() => setAnswer(false)}
            disabled={disabled}
            className={`p-5 md:p-6 text-xl md:text-2xl font-black text-white rounded-2xl active:scale-95 transition-all disabled:opacity-50 ${
              answer === false
                ? "bg-red-600 ring-4 ring-red-400 scale-[1.02]"
                : "bg-red-500/80 backdrop-blur-sm hover:bg-red-600/80"
            }`}
          >
            ❌ FALSE
          </button>
        </div>
        <button
          onClick={() => onSubmit(answer)}
          disabled={disabled || answer === null}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50 disabled:from-gray-500 disabled:to-gray-600"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Open Text Question - OPEN_TEXT, PHOTO_OPEN_TEXT
  if (questionType === "OPEN_TEXT" || questionType === "PHOTO_OPEN_TEXT") {
    return (
      <div className="space-y-3 md:space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Ordering Question - MC_ORDER (and legacy ORDER, PHOTO_MC_ORDER)
  if (questionType === "MC_ORDER" || questionType === "ORDER" || questionType === "PHOTO_MC_ORDER") {
    return (
      <OrderingInput
        options={options || []}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Photo questions with OPEN_TEXT base type (PHOTO_OPEN_TEXT, AUDIO_OPEN, VIDEO_OPEN)
  const baseType = getBaseQuestionType(questionType as QuestionType);
  if (
    requiresPhotos(questionType as QuestionType) && baseType === "OPEN_TEXT"
  ) {
    return (
      <div className="space-y-3 md:space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What do you see?"
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
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
      <div className="space-y-3 md:space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What do you hear?"
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
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
      <div className="space-y-3 md:space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What did you see?"
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
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
      <div className="space-y-3 md:space-y-4">
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
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // MUSIC_GUESS_YEAR - Dedicated year picker with decade buttons + slider
  if (questionType === "MUSIC_GUESS_YEAR") {
    return (
      <YearPicker
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  // Numeric input questions - NUMERIC, SLIDER, ESTIMATION, PHOTO_NUMERIC, PHOTO_SLIDER
  if (
    questionType === "NUMERIC" ||
    questionType === "SLIDER" ||
    questionType === "ESTIMATION" ||
    questionType === "PHOTO_NUMERIC" ||
    questionType === "PHOTO_SLIDER"
  ) {
    return (
      <div className="space-y-3 md:space-y-4">
        <input
          type="number"
          value={answer || ""}
          onChange={(e) => setAnswer(parseInt(e.target.value) || "")}
          placeholder="Enter a number..."
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
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
      <div className="space-y-3 md:space-y-4">
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={disabled}
          className="w-full px-4 md:px-6 py-4 text-lg md:text-xl font-bold text-white bg-slate-800 rounded-xl focus:ring-4 focus:ring-purple-300 outline-none transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !answer?.trim()}
          className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
    );
  }

  // Poll - POLL (shows options like MC_SINGLE but without scoring)
  if (questionType === "POLL") {
    return (
      <div className="space-y-2 md:space-y-3">
        {options?.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              setAnswer(option.id);
              setTimeout(() => onSubmit(option.id), 100);
            }}
            disabled={disabled}
            className="w-full p-4 md:p-5 min-h-[52px] text-base md:text-lg font-bold text-white bg-slate-800/20 backdrop-blur-sm rounded-xl hover:bg-slate-800/30 active:scale-95 transition-all disabled:opacity-50"
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

// Year Picker component for MUSIC_GUESS_YEAR
function YearPicker({
  onSubmit,
  disabled,
}: {
  onSubmit: (answer: any) => void;
  disabled: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(2000);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);

  const decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

  const handleDecadeSelect = (decade: number) => {
    setSelectedDecade(decade);
    setSelectedYear(decade + 5); // Start in middle of decade
  };

  const yearsInDecade = selectedDecade !== null
    ? Array.from({ length: 10 }, (_, i) => selectedDecade + i).filter(y => y <= currentYear)
    : [];

  return (
    <div className="space-y-4">
      {/* Decade selector */}
      <div>
        <p className="text-center text-white/70 text-sm font-medium mb-2">Choose a decade</p>
        <div className="grid grid-cols-4 gap-2">
          {decades.map((decade) => (
            <button
              key={decade}
              onClick={() => handleDecadeSelect(decade)}
              disabled={disabled}
              className={`py-3 px-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                selectedDecade === decade
                  ? "bg-green-500 text-white ring-2 ring-green-300 shadow-lg shadow-green-500/30"
                  : "bg-slate-800/40 text-white/80 hover:bg-slate-700/60"
              }`}
            >
              {decade}s
            </button>
          ))}
        </div>
      </div>

      {/* Year grid within selected decade */}
      {selectedDecade !== null && (
        <div>
          <p className="text-center text-white/70 text-sm font-medium mb-2">Pick the year</p>
          <div className="grid grid-cols-5 gap-2">
            {yearsInDecade.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                disabled={disabled}
                className={`py-3 rounded-xl text-base font-bold transition-all active:scale-95 ${
                  selectedYear === year
                    ? "bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg shadow-purple-500/30 scale-105"
                    : "bg-slate-800/40 text-white/80 hover:bg-slate-700/60"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected year display */}
      <div className="text-center py-2">
        <p className="text-5xl font-black text-white tabular-nums">{selectedYear}</p>
      </div>

      {/* Fine-tune slider */}
      <div className="px-2">
        <input
          type="range"
          min={1950}
          max={currentYear}
          value={selectedYear}
          onChange={(e) => {
            const year = parseInt(e.target.value);
            setSelectedYear(year);
            setSelectedDecade(Math.floor(year / 10) * 10);
          }}
          disabled={disabled}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>1950</span>
          <span>{currentYear}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => onSubmit(selectedYear)}
        disabled={disabled}
        className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-green-500/20"
      >
        🎵 Submit {selectedYear}
      </button>
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
    <div className="space-y-3 md:space-y-4">
      <div className="space-y-2 md:space-y-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => toggleOption(option.id)}
            disabled={disabled}
            className={`w-full p-4 md:p-5 min-h-[52px] text-base md:text-lg font-bold text-white rounded-xl transition-all disabled:opacity-50 ${
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
        className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
      >
        Submit ({selected.length} selected)
      </button>
    </div>
  );
}

// Ordering component with tap-to-select-and-place (mobile-friendly)
function OrderingInput({
  options,
  onSubmit,
  disabled,
}: {
  options: Array<{ id: string; text: string }>;
  onSubmit: (answer: any) => void;
  disabled: boolean;
}) {
  // Shuffle options on mount for random display order
  const [items, setItems] = useState<Array<{ id: string; text: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Fisher-Yates shuffle on initial mount only
  useEffect(() => {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setItems(shuffled);
  }, []); // Only on mount - options are stable per question

  const handleTapItem = useCallback((index: number) => {
    if (disabled) return;
    
    if (selectedIndex === null) {
      // First tap: select this item (highlight it)
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      // Tap same item: deselect
      setSelectedIndex(null);
    } else {
      // Second tap on different item: swap positions
      const newItems = [...items];
      [newItems[selectedIndex], newItems[index]] = [newItems[index], newItems[selectedIndex]];
      setItems(newItems);
      setSelectedIndex(null);
    }
  }, [disabled, selectedIndex, items]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 md:space-y-4">
      <p className="text-center text-white/80 font-bold text-sm md:text-base mb-2">
        Tik om te selecteren, tik op een andere positie om te verwisselen:
      </p>
      
      {/* Selection hint */}
      {selectedIndex !== null && (
        <div className="text-center text-purple-300 text-xs animate-pulse mb-1">
          Tik nu op de positie waar je &quot;{items[selectedIndex]?.text}&quot; wilt plaatsen
        </div>
      )}
      
      <div className="space-y-2">
        {items.map((item, index) => {
          const isSelected = selectedIndex === index;
          const isSwapTarget = selectedIndex !== null && selectedIndex !== index;
          
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTapItem(index)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 rounded-xl p-3 md:p-4 transition-all active:scale-[0.98] ${
                isSelected
                  ? "bg-purple-600 ring-4 ring-purple-400 scale-[1.02] shadow-lg shadow-purple-500/40"
                  : isSwapTarget
                    ? "bg-slate-700/60 border-2 border-dashed border-purple-400/50 hover:border-purple-400"
                    : "bg-slate-800/20 backdrop-blur-sm border-2 border-transparent"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              {/* Position number */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-black flex-shrink-0 ${
                isSelected 
                  ? "bg-white/30 text-white" 
                  : "bg-white/10 text-white/70"
              }`}>
                {index + 1}
              </span>
              
              {/* Item text */}
              <span className="flex-1 font-bold text-white text-sm md:text-base text-left min-w-0 break-words">
                {item.text}
              </span>
              
              {/* Swap indicator */}
              {isSelected && (
                <span className="text-white/70 text-lg flex-shrink-0">↕</span>
              )}
              {isSwapTarget && (
                <span className="text-purple-300/70 text-sm flex-shrink-0">↔</span>
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onSubmit(items.map((item) => item.id))}
        disabled={disabled}
        className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        type="button"
      >
        Volgorde indienen
      </button>
    </div>
  );
}
