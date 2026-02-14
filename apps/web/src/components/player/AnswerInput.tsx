"use client";

import { useState } from "react";
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

  // Numeric input questions - NUMERIC, SLIDER, ESTIMATION, PHOTO_NUMERIC, PHOTO_SLIDER, MUSIC_GUESS_YEAR
  if (
    questionType === "NUMERIC" ||
    questionType === "SLIDER" ||
    questionType === "ESTIMATION" ||
    questionType === "PHOTO_NUMERIC" ||
    questionType === "PHOTO_SLIDER" ||
    questionType === "MUSIC_GUESS_YEAR"
  ) {
    return (
      <div className="space-y-3 md:space-y-4">
        <input
          type="number"
          value={answer || ""}
          onChange={(e) => setAnswer(parseInt(e.target.value) || "")}
          placeholder="Year (e.g., 1985)"
          disabled={disabled}
          min={1900}
          max={2100}
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set drag image to be more visible
    if (e.currentTarget) {
      e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    
    // Remove from old position
    newItems.splice(draggedIndex, 1);
    // Insert at new position
    newItems.splice(dropIndex, 0, draggedItem);
    
    setItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch handlers for mobile (fallback for older browsers)
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentY, setTouchCurrentY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || draggedIndex === null || touchStartY === null) return;
    setTouchCurrentY(e.touches[0].clientY);
    
    // Prevent scrolling while dragging
    e.preventDefault();
    
    // Calculate which item we're over
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const orderItem = elements.find(el => el.hasAttribute('data-order-index'));
    if (orderItem) {
      const overIndex = parseInt(orderItem.getAttribute('data-order-index') || '0');
      setDragOverIndex(overIndex);
    }
  };

  const handleTouchEnd = () => {
    if (disabled || draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setTouchStartY(null);
      setTouchCurrentY(null);
      return;
    }

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    
    // Remove from old position
    newItems.splice(draggedIndex, 1);
    // Insert at new position
    newItems.splice(dragOverIndex, 0, draggedItem);
    
    setItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartY(null);
    setTouchCurrentY(null);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <p className="text-center text-white/80 font-bold text-sm md:text-base mb-3 md:mb-4">
        Sleep de items in de goede volgorde (of gebruik de ▲▼ knoppen):
      </p>
      <div className="space-y-2">
        {items.map((item, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index && draggedIndex !== index;
          
          return (
            <div
              key={item.id}
              data-order-index={index}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`flex items-center gap-2 bg-slate-800/20 backdrop-blur-sm rounded-xl p-3 md:p-4 transition-all ${
                isDragging 
                  ? "opacity-50 scale-95 rotate-2" 
                  : isDragOver 
                  ? "border-2 border-purple-500 scale-105 shadow-lg shadow-purple-500/50" 
                  : "border-2 border-transparent"
              } ${!disabled ? "cursor-move touch-none" : "cursor-not-allowed"}`}
            >
              {/* Drag handle icon */}
              <div className="text-white/50 text-lg select-none flex-shrink-0">
                ⋮⋮
              </div>
              
              {/* Up/Down buttons (fallback) */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => moveUp(index)}
                  disabled={disabled || index === 0}
                  className="p-1.5 md:p-2 text-white bg-slate-800/20 rounded hover:bg-slate-800/30 disabled:opacity-30 transition-all min-w-[32px] min-h-[28px]"
                  type="button"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={disabled || index === items.length - 1}
                  className="p-1.5 md:p-2 text-white bg-slate-800/20 rounded hover:bg-slate-800/30 disabled:opacity-30 transition-all min-w-[32px] min-h-[28px]"
                  type="button"
                >
                  ▼
                </button>
              </div>
              
              {/* Item text */}
              <div className="flex-1 font-bold text-white text-sm md:text-base select-none min-w-0 break-words">
                {index + 1}. {item.text}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onSubmit(items.map((item) => item.id))}
        disabled={disabled}
        className="w-full py-4 md:py-5 text-lg md:text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all disabled:opacity-50"
        type="button"
      >
        Submit Order
      </button>
    </div>
  );
}
