"use client";

import { useState, useMemo } from "react";
import { QuestionType } from "@partyquiz/shared";

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
  answeredAt: number;
  selectedOptionIds?: string[];
  submittedOrder?: string[];
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
}: AnswerPanelProps) {
  const [sortBy, setSortBy] = useState<"time" | "score" | "name">("time");

  // Sort answers based on selected criteria
  const sortedAnswers = useMemo(() => {
    const sorted = [...answers];
    switch (sortBy) {
      case "time":
        return sorted.sort((a, b) => a.answeredAt - b.answeredAt);
      case "score":
        return sorted.sort((a, b) => b.score - a.score);
      case "name":
        return sorted.sort((a, b) => a.playerName.localeCompare(b.playerName));
      default:
        return sorted;
    }
  }, [answers, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const correctCount = answers.filter((a) => a.isCorrect === true).length;
    const incorrectCount = answers.filter((a) => a.isCorrect === false).length;
    const pendingCount = totalPlayers - answers.length;
    const totalScore = answers.reduce((sum, a) => sum + a.score, 0);
    const avgScore = answers.length > 0 ? Math.round(totalScore / answers.length) : 0;
    
    return { correctCount, incorrectCount, pendingCount, totalScore, avgScore };
  }, [answers, totalPlayers]);

  // For MC questions, calculate option distribution
  const optionDistribution = useMemo(() => {
    if (!options || !["MC_SINGLE", "MC_MULTIPLE", "POLL", "TRUE_FALSE", "PHOTO_QUESTION", "AUDIO_QUESTION", "VIDEO_QUESTION"].includes(questionType?.toUpperCase() || "")) {
      return null;
    }
    
    const distribution: Record<string, { count: number; text: string; isCorrect?: boolean }> = {};
    options.forEach((opt) => {
      distribution[opt.id] = { count: 0, text: opt.text, isCorrect: opt.isCorrect };
    });
    
    answers.forEach((answer) => {
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

  // Get status icon and color
  const getStatusIcon = (isCorrect: boolean | null): { icon: string; color: string } => {
    if (isCorrect === null) return { icon: "💬", color: "text-blue-600" }; // Poll/no score
    if (isCorrect) return { icon: "✅", color: "text-green-600" };
    return { icon: "❌", color: "text-red-600" };
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
    const type = answer.questionType?.toUpperCase();
    
    // ORDER questions: show numbered list
    if (type === "ORDER" && answer.submittedOrder && options) {
      return (
        <div className="text-xs space-y-0.5">
          {answer.submittedOrder.map((optId, idx) => {
            const opt = options.find((o) => o.id === optId);
            const correctPos = correctOrder?.find((o) => o.id === optId)?.position;
            const isCorrectPosition = correctPos === idx + 1;
            return (
              <div
                key={optId}
                className={`flex items-center gap-1 ${isCorrectPosition ? "text-green-700" : "text-red-700"}`}
              >
                <span className="font-mono">{idx + 1}.</span>
                <span className="truncate">{opt?.text || optId}</span>
                {isCorrectPosition && <span className="text-green-500">✓</span>}
              </div>
            );
          })}
        </div>
      );
    }
    
    // MC_MULTIPLE: show selected options as badges
    if (type === "MC_MULTIPLE" && answer.selectedOptionIds && options) {
      return (
        <div className="flex flex-wrap gap-1">
          {answer.selectedOptionIds.map((optId) => {
            const opt = options.find((o) => o.id === optId);
            const isCorrectOption = opt?.isCorrect;
            return (
              <span
                key={optId}
                className={`px-1.5 py-0.5 rounded text-xs ${
                  isCorrectOption
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {opt?.text || optId}
              </span>
            );
          })}
        </div>
      );
    }
    
    // ESTIMATION: show number with distance indicator
    if (type === "ESTIMATION" || type === "MUSIC_GUESS_YEAR") {
      const scorePercent = answer.score > 0 ? Math.round((answer.score / 100) * 100) : 0;
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{answer.answerDisplay}</span>
          {answer.score > 0 && (
            <span className="text-xs text-gray-500">({scorePercent}% punten)</span>
          )}
        </div>
      );
    }
    
    // Default: show formatted display
    return <span className="text-sm">{answer.answerDisplay}</span>;
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
          <span className="font-medium">Antwoorden</span>
          <span className="text-sm text-gray-500">
            {answers.length}/{totalPlayers} spelers
          </span>
        </div>
        
        {/* Quick stats */}
        <div className="flex items-center gap-4 text-sm">
          {stats.correctCount > 0 && (
            <span className="text-green-600">✅ {stats.correctCount}</span>
          )}
          {stats.incorrectCount > 0 && (
            <span className="text-red-600">❌ {stats.incorrectCount}</span>
          )}
          {stats.pendingCount > 0 && (
            <span className="text-gray-400">⏳ {stats.pendingCount}</span>
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Option distribution for MC questions */}
          {optionDistribution && Object.keys(optionDistribution).length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-b">
              <div className="text-xs text-gray-500 mb-2 font-medium">Antwoord verdeling:</div>
              <div className="space-y-1.5">
                {Object.entries(optionDistribution).map(([optId, data]) => {
                  const percentage = answers.length > 0 
                    ? Math.round((data.count / answers.length) * 100) 
                    : 0;
                  return (
                    <div key={optId} className="flex items-center gap-2">
                      <div className="w-32 truncate text-sm flex items-center gap-1">
                        {data.isCorrect && <span className="text-green-500">✓</span>}
                        {data.text}
                      </div>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${data.isCorrect ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs text-gray-600">
                        {data.count} ({percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Sort controls */}
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-xs">
            <span className="text-gray-500">Sorteer:</span>
            <button
              onClick={() => setSortBy("time")}
              className={`px-2 py-1 rounded ${sortBy === "time" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              ⏱️ Tijd
            </button>
            <button
              onClick={() => setSortBy("score")}
              className={`px-2 py-1 rounded ${sortBy === "score" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              🏆 Score
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded ${sortBy === "name" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              👤 Naam
            </button>
          </div>
          
          {/* Answer list */}
          <div className="max-h-64 overflow-y-auto">
            {sortedAnswers.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                Nog geen antwoorden ontvangen...
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-2">Speler</th>
                    <th className="px-4 py-2">Antwoord</th>
                    <th className="px-4 py-2 text-center w-16">✓/✗</th>
                    <th className="px-4 py-2 text-right w-20">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedAnswers.map((answer) => {
                    const status = getStatusIcon(answer.isCorrect);
                    return (
                      <tr key={answer.playerId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{answer.playerAvatar || "👤"}</span>
                            <div>
                              <div className="font-medium">{answer.playerName}</div>
                              <div className="text-xs text-gray-400">{formatTimeAgo(answer.answeredAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {renderAnswerContent(answer)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-lg ${status.color}`}>{status.icon}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {answer.score > 0 ? (
                            <span className="font-medium text-green-600">+{answer.score}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
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
            <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600 flex justify-between">
              <span>
                Gemiddelde score: <strong>{stats.avgScore}</strong> punten
              </span>
              <span>
                {Math.round((stats.correctCount / answers.length) * 100)}% correct
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
