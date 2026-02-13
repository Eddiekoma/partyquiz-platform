"use client";

import { useState, useMemo } from "react";
import { QuestionType } from "@partyquiz/shared";

// Helper to check if a question type is an open text type (allows score adjustment)
const isOpenTextType = (questionType: string | undefined): boolean => {
  if (!questionType) return false;
  const type = questionType.toUpperCase();
  return type === "OPEN_TEXT" || type === "PHOTO_OPEN_TEXT" || 
         type === "AUDIO_OPEN" || type === "VIDEO_OPEN";
};

/**
 * Represents a player's answer in the host answer panel
 */
export interface PlayerAnswer {
  itemId: string;
  playerId: string;
  playerName: string;
  playerAvatar?: string | null;
  questionType: string;
  answerDisplay: string;
  rawAnswer: any;
  isCorrect: boolean | null;
  score: number;
  maxScore?: number; // Maximum possible score for this question
  answeredAt: number;
  timeSpentMs?: number; // How long it took to answer (milliseconds)
  selectedOptionIds?: string[];
  submittedOrder?: string[];
  // For OPEN_TEXT: auto scoring info (allows host to adjust)
  answerId?: string; // Database ID for score adjustment
  autoScore?: number; // Auto-calculated score
  autoScorePercentage?: number; // Auto-calculated percentage (0-100)
  isManuallyAdjusted?: boolean; // Host has adjusted
  // For players who didn't submit an answer
  noAnswer?: boolean; // True if player didn't submit answer before reveal
}

interface AnswerPanelProps {
  answers: PlayerAnswer[];
  questionType?: string;
  totalPlayers: number;
  isExpanded: boolean;
  onToggle: () => void;
  // For ORDER questions, show correct order
  correctOrder?: Array<{ id: string; text: string; position: number }>;
  // For MC questions, show options with correct indicator
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  // For OPEN_TEXT: callback to adjust score
  onAdjustScore?: (answerId: string, playerId: string, itemId: string, scorePercentage: number) => void;
}

/**
 * Collapsible panel showing who answered what during a quiz question.
 * Supports all question types with appropriate formatting.
 */
export function AnswerPanel({
  answers,
  questionType,
  totalPlayers,
  isExpanded,
  onToggle,
  correctOrder,
  options,
  onAdjustScore,
}: AnswerPanelProps) {
  const [sortBy, setSortBy] = useState<"time" | "score" | "name">("time");
  // Track which answers are being adjusted (show buttons)
  const [adjustingAnswerId, setAdjustingAnswerId] = useState<string | null>(null);

  // Sort answers based on selected criteria
  const sortedAnswers = useMemo(() => {
    const sorted = [...answers];
    
    // Separate answered and no-answer players
    const answeredPlayers = sorted.filter(a => !a.noAnswer);
    const noAnswerPlayers = sorted.filter(a => a.noAnswer);
    
    // Sort answered players based on criteria
    switch (sortBy) {
      case "time":
        answeredPlayers.sort((a, b) => a.answeredAt - b.answeredAt);
        break;
      case "score":
        answeredPlayers.sort((a, b) => b.score - a.score);
        break;
      case "name":
        answeredPlayers.sort((a, b) => a.playerName.localeCompare(b.playerName));
        break;
    }
    
    // Sort no-answer players by name
    noAnswerPlayers.sort((a, b) => a.playerName.localeCompare(b.playerName));
    
    // Return answered players first, then no-answer players
    return [...answeredPlayers, ...noAnswerPlayers];
  }, [answers, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const answeredPlayers = answers.filter(a => !a.noAnswer);
    const noAnswerPlayers = answers.filter(a => a.noAnswer);
    
    const correctCount = answeredPlayers.filter((a) => a.isCorrect === true).length;
    const incorrectCount = answeredPlayers.filter((a) => a.isCorrect === false).length;
    const noAnswerCount = noAnswerPlayers.length;
    const pendingCount = totalPlayers - answers.length; // Players not in the system yet
    const totalScore = answeredPlayers.reduce((sum, a) => sum + a.score, 0);
    const avgScore = answeredPlayers.length > 0 ? Math.round(totalScore / answeredPlayers.length) : 0;
    
    // Calculate average score percentage (how correct were answers on average)
    const totalScorePercentage = answeredPlayers.reduce((sum, a) => {
      // Calculate score percentage for each answer
      const scorePercentage = a.maxScore && a.maxScore > 0 
        ? (a.score / a.maxScore) * 100
        : a.score > 0 ? 100 : 0;
      return sum + scorePercentage;
    }, 0);
    const avgScorePercentage = answeredPlayers.length > 0 
      ? Math.round(totalScorePercentage / answeredPlayers.length) 
      : 0;
    
    return { 
      correctCount, 
      incorrectCount, 
      noAnswerCount, 
      pendingCount, 
      totalScore, 
      avgScore,
      avgScorePercentage 
    };
  }, [answers, totalPlayers]);

  // For MC questions, calculate option distribution
  const optionDistribution = useMemo(() => {
    const mcTypes = [
      "MC_SINGLE", "MC_MULTIPLE", "MC_ORDER", "POLL", "TRUE_FALSE",
      "PHOTO_MC_SINGLE", "PHOTO_MC_MULTIPLE", "PHOTO_MC_ORDER", "PHOTO_TRUE_FALSE",
      "AUDIO_QUESTION", "VIDEO_QUESTION"
    ];
    if (!options || !mcTypes.includes(questionType?.toUpperCase() || "")) {
      return null;
    }
    
    const distribution: Record<string, { count: number; text: string; isCorrect?: boolean }> = {};
    options.forEach((opt) => {
      distribution[opt.id] = { count: 0, text: opt.text, isCorrect: opt.isCorrect };
    });
    
    // Only count answers from players who actually answered (skip no-answer players)
    const answeredPlayers = answers.filter(a => !a.noAnswer);
    answeredPlayers.forEach((answer) => {
      if (answer.selectedOptionIds) {
        answer.selectedOptionIds.forEach((optId) => {
          if (distribution[optId]) {
            distribution[optId].count++;
          }
        });
      }
    });
    
    return distribution;
  }, [answers, options, questionType]);

  // Get status icon and color - now supports partial correct and no-answer
  const getStatusIcon = (answer: PlayerAnswer): { icon: string; color: string; label: string } => {
    // No answer submitted
    if (answer.noAnswer) {
      return { icon: "⏳", color: "text-slate-500", label: "No answer" };
    }
    
    // Poll or no scoring
    if (answer.isCorrect === null) {
      return { icon: "💬", color: "text-blue-400", label: "Poll" };
    }
    
    // Calculate score percentage for graduated feedback
    const scorePercentage = answer.maxScore && answer.maxScore > 0 
      ? Math.round((answer.score / answer.maxScore) * 100)
      : answer.score > 0 ? 100 : 0;
    
    // Perfect score
    if (scorePercentage === 100) {
      return { icon: "✅", color: "text-green-400", label: "Perfect" };
    }
    
    // Almost perfect (90-99%)
    if (scorePercentage >= 90) {
      return { icon: "🌟", color: "text-green-300", label: "Almost" };
    }
    
    // Close enough (70-89%)
    if (scorePercentage >= 70) {
      return { icon: "🟢", color: "text-green-200", label: "Close" };
    }
    
    // Partial correct (50-69%)
    if (scorePercentage >= 50) {
      return { icon: "🟡", color: "text-yellow-400", label: "Partial" };
    }
    
    // Some points (1-49%)
    if (scorePercentage > 0) {
      return { icon: "🟠", color: "text-orange-400", label: "Points" };
    }
    
    // Completely wrong
    return { icon: "❌", color: "text-red-400", label: "Wrong" };
  };

  // Format time spent answering
  const formatTimeSpent = (timeSpentMs?: number): string | null => {
    if (!timeSpentMs) return null;
    const seconds = timeSpentMs / 1000;
    if (seconds < 1) return `${Math.round(timeSpentMs)}ms`;
    if (seconds < 10) return `${seconds.toFixed(1)}s`;
    return `${Math.round(seconds)}s`;
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s geleden`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m geleden`;
  };

  // Get question type specific rendering
  const renderAnswerContent = (answer: PlayerAnswer) => {
    // No answer submitted - show special message
    if (answer.noAnswer) {
      return (
        <span className="text-sm text-slate-500 italic">
          Geen antwoord ingediend
        </span>
      );
    }
    
    const type = answer.questionType?.toUpperCase();
    
    // ORDER questions: show numbered list (supports both ORDER and MC_ORDER)
    if ((type === "ORDER" || type === "MC_ORDER") && answer.submittedOrder && options) {
      return (
        <div className="text-xs space-y-0.5">
          {answer.submittedOrder.map((optId, idx) => {
            const opt = options.find((o) => o.id === optId);
            const correctPos = correctOrder?.find((o) => o.id === optId)?.position;
            const isCorrectPosition = correctPos === idx + 1;
            return (
              <div
                key={optId}
                className={`flex items-center gap-1 ${isCorrectPosition ? "text-green-400" : "text-red-400"}`}
              >
                <span className="font-mono">{idx + 1}.</span>
                <span className="truncate">{opt?.text || optId}</span>
                {isCorrectPosition && <span className="text-green-400">✓</span>}
              </div>
            );
          })}
        </div>
      );
    }
    
    // MC_MULTIPLE: show selected options as badges
    if (type === "MC_MULTIPLE" && options) {
      // Get selected option IDs from selectedOptionIds or rawAnswer
      const selectedIds = answer.selectedOptionIds || 
        (Array.isArray(answer.rawAnswer) ? answer.rawAnswer : []);
      
      if (selectedIds.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {selectedIds.map((optId) => {
              const opt = options.find((o) => o.id === optId);
              const isCorrectOption = opt?.isCorrect;
              return (
                <span
                  key={optId}
                  className={`px-1.5 py-0.5 rounded text-xs ${
                    isCorrectOption
                      ? "bg-green-900/50 text-green-300"
                      : "bg-red-900/50 text-red-300"
                  }`}
                >
                  {opt?.text || optId}
                </span>
              );
            })}
          </div>
        );
      }
    }
    
    // NUMERIC/SLIDER/ESTIMATION: show number with distance indicator
    const numericTypes = ["NUMERIC", "SLIDER", "ESTIMATION", "PHOTO_NUMERIC", "PHOTO_SLIDER", "MUSIC_GUESS_YEAR"];
    if (numericTypes.includes(type)) {
      // Debug: log what we received
      console.log("[AnswerPanel] ESTIMATION answer:", { 
        answerDisplay: answer.answerDisplay, 
        rawAnswer: answer.rawAnswer,
        score: answer.score,
        playerName: answer.playerName 
      });
      
      // Use rawAnswer as fallback if answerDisplay is empty
      const displayValue = answer.answerDisplay || 
        (answer.rawAnswer !== undefined && answer.rawAnswer !== null 
          ? String(answer.rawAnswer) 
          : "(no answer)");
      
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-white">{displayValue}</span>
          {answer.score > 0 && (
            <span className="text-xs text-slate-400">(+{answer.score} points)</span>
          )}
        </div>
      );
    }
    
    // Default: show formatted display
    return <span className="text-sm text-white">{answer.answerDisplay}</span>;
  };

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-sm">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
          <span className="font-medium text-white">Answers</span>
          <span className="text-sm text-slate-400">
            {answers.length}/{totalPlayers} players
          </span>
        </div>
        
        {/* Quick stats */}
        <div className="flex items-center gap-4 text-sm">
          {stats.correctCount > 0 && (
            <span className="text-green-400">✅ {stats.correctCount}</span>
          )}
          {stats.incorrectCount > 0 && (
            <span className="text-red-400">❌ {stats.incorrectCount}</span>
          )}
          {stats.noAnswerCount > 0 && (
            <span className="text-slate-500">⏳ {stats.noAnswerCount}</span>
          )}
          {stats.pendingCount > 0 && (
            <span className="text-slate-400">⏱️ {stats.pendingCount}</span>
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-600">
          {/* Option distribution for MC questions */}
          {optionDistribution && Object.keys(optionDistribution).length > 0 && (
            <div className="px-4 py-3 bg-slate-700 border-b border-slate-600">
              <div className="text-xs text-slate-400 mb-2 font-medium">
                Selected by players: <span className="text-slate-500">(✓ = correct answer)</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(optionDistribution).map(([optId, data]) => {
                  // Only count players who actually answered (exclude no-answer)
                  const answeredCount = answers.filter(a => !a.noAnswer).length;
                  const percentage = answeredCount > 0 
                    ? Math.round((data.count / answeredCount) * 100) 
                    : 0;
                  return (
                    <div key={optId} className="flex items-center gap-2">
                      <div className="w-32 truncate text-sm text-white flex items-center gap-1">
                        {data.isCorrect && <span className="text-green-400">✓</span>}
                        <span className={data.isCorrect ? "text-green-300" : ""}>{data.text}</span>
                      </div>
                      <div className="flex-1 h-4 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${data.isCorrect ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-xs">
                        {data.count > 0 ? (
                          <span className="text-white font-medium">{data.count}x</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Sort controls */}
          <div className="px-4 py-2 bg-slate-700 border-b border-slate-600 flex items-center gap-2 text-xs">
            <span className="text-slate-400">Sorteer:</span>
            <button
              onClick={() => setSortBy("time")}
              className={`px-2 py-1 rounded ${sortBy === "time" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-600"}`}
            >
              ⏱️ Tijd
            </button>
            <button
              onClick={() => setSortBy("score")}
              className={`px-2 py-1 rounded ${sortBy === "score" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-600"}`}
            >
              🏆 Score
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded ${sortBy === "name" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-600"}`}
            >
              👤 Name
            </button>
          </div>
          
          {/* Answer list */}
          <div className="max-h-64 overflow-y-auto">
            {sortedAnswers.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400">
                No answers received yet...
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-700 sticky top-0">
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2">Answer</th>
                    <th className="px-4 py-2 text-center w-16">✓/✗</th>
                    <th className="px-4 py-2 text-right w-20">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  {sortedAnswers.map((answer) => {
                    const status = getStatusIcon(answer);
                    const timeSpent = formatTimeSpent(answer.timeSpentMs);
                    // Debug: log each answer to find the issue
                    console.log("[AnswerPanel] Rendering answer:", {
                      playerId: answer.playerId,
                      playerName: answer.playerName,
                      answerDisplay: answer.answerDisplay,
                      questionType: answer.questionType,
                      timeSpentMs: answer.timeSpentMs,
                    });
                    return (
                      <tr key={answer.playerId} className="hover:bg-slate-700">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{answer.playerAvatar || "👤"}</span>
                            <div>
                              <div className="font-medium text-white">{answer.playerName || "(unknown)"}</div>
                              <div className="text-xs text-slate-400 flex items-center gap-2">
                                <span>{formatTimeAgo(answer.answeredAt)}</span>
                                {timeSpent && (
                                  <span className="text-blue-400">⚡ {timeSpent}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-white">
                          {renderAnswerContent(answer)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-lg ${status.color}`}>{status.icon}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {/* For OPEN_TEXT types: show score adjustment buttons */}
                          {isOpenTextType(answer.questionType) && answer.answerId && onAdjustScore ? (
                            <div className="flex flex-col items-end gap-1">
                              {/* Current score with edit button */}
                              <div className="flex items-center gap-2">
                                {answer.isManuallyAdjusted && (
                                  <span className="text-xs text-purple-400" title="Manually adjusted">✏️</span>
                                )}
                                <span className={`font-medium ${answer.score > 0 ? "text-green-400" : "text-slate-400"}`}>
                                  {answer.score > 0 ? `+${answer.score}` : "0"}
                                </span>
                                <button
                                  onClick={() => setAdjustingAnswerId(
                                    adjustingAnswerId === answer.answerId ? null : answer.answerId!
                                  )}
                                  className="text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300"
                                  title="Adjust score"
                                >
                                  ✏️
                                </button>
                              </div>
                              
                              {/* Score adjustment buttons (shown when editing) */}
                              {adjustingAnswerId === answer.answerId && (
                                <div className="flex gap-1 mt-1">
                                  {[0, 25, 50, 75, 100].map((pct) => {
                                    const maxScore = answer.maxScore || 10;
                                    const pctScore = Math.round((pct / 100) * maxScore);
                                    const isCurrentScore = answer.score === pctScore;
                                    return (
                                      <button
                                        key={pct}
                                        onClick={() => {
                                          onAdjustScore(answer.answerId!, answer.playerId, answer.itemId, pct);
                                          setAdjustingAnswerId(null);
                                        }}
                                        className={`text-xs px-1.5 py-1 rounded font-medium transition-all ${
                                          isCurrentScore
                                            ? "bg-purple-600 text-white ring-2 ring-purple-400"
                                            : pct === 100
                                            ? "bg-green-600/80 text-white hover:bg-green-500"
                                            : pct === 0
                                            ? "bg-red-600/80 text-white hover:bg-red-500"
                                            : "bg-slate-600 text-slate-200 hover:bg-slate-500"
                                        }`}
                                        title={`${pct}% = ${pctScore} points`}
                                      >
                                        {pct}%
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Show auto score hint if different */}
                              {answer.autoScorePercentage !== undefined && !answer.isManuallyAdjusted && (
                                <span className="text-xs text-slate-500">
                                  Auto: {answer.autoScorePercentage}%
                                </span>
                              )}
                            </div>
                          ) : (
                            // Default score display for non-OPEN_TEXT
                            answer.score > 0 ? (
                              <span className="font-medium text-green-400">+{answer.score}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Footer with averages */}
          {answers.length > 0 && (
            <div className="px-4 py-2 bg-slate-700 border-t border-slate-600 text-xs text-slate-300 flex justify-between">
              <span>
                Average score: <strong className="text-white">{stats.avgScore}</strong> points
              </span>
              <span>
                Average: <strong className="text-white">{stats.avgScorePercentage}%</strong> correct
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
