"use client";

import { getScoringInfo, ScoringMode } from "@partyquiz/shared";

interface ScoringInfoCardProps {
  questionType: string;
  /** Example base points for preview (actual set per quiz) */
  exampleBasePoints?: number;
  showBonuses?: boolean;
  /** Show time bonus in preview */
  showTimeBonusExample?: boolean;
  /** Example time bonus percentage */
  exampleTimeBonusPercentage?: number;
  /** Show streak bonus in preview */
  showStreakBonusExample?: boolean;
  /** Example streak bonus points */
  exampleStreakBonusPoints?: number;
}

/**
 * ScoringInfoCard - Displays how scoring works for a question type
 * Shows EXAMPLE calculations - actual points are configured per Quiz
 */
export function ScoringInfoCard({
  questionType,
  exampleBasePoints = 10,
  showBonuses = true,
  showTimeBonusExample = true,
  exampleTimeBonusPercentage = 50,
  showStreakBonusExample = true,
  exampleStreakBonusPoints = 1,
}: ScoringInfoCardProps) {
  const scoringInfo = getScoringInfo(questionType);
  
  // Get icon for scoring mode
  const getModeIcon = (mode: ScoringMode) => {
    switch (mode) {
      case ScoringMode.EXACT_MATCH:
        return "✓";
      case ScoringMode.PARTIAL_MULTI:
        return "☑️";
      case ScoringMode.PARTIAL_ORDER:
        return "📊";
      case ScoringMode.FUZZY_TEXT:
        return "📝";
      case ScoringMode.NUMERIC_DISTANCE:
        return "🎯";
      case ScoringMode.NO_SCORE:
        return "🗳️";
      default:
        return "📊";
    }
  };

  // Calculate example points for tiers
  const calculateExamplePoints = (percentage: number) => {
    return Math.round((percentage / 100) * exampleBasePoints);
  };

  // Get color for percentage
  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-400";
    if (percentage >= 70) return "text-lime-400";
    if (percentage >= 50) return "text-yellow-400";
    if (percentage >= 25) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      {/* Header with example indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getModeIcon(scoringInfo.mode)}</span>
          <h4 className="font-semibold text-white">Hoe werkt de scoring?</h4>
        </div>
        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
          📝 Voorbeeld
        </span>
      </div>

      {/* Mode title and description */}
      <div className="mb-4">
        <p className="text-sm font-medium text-purple-400">{scoringInfo.title}</p>
        <p className="text-sm text-slate-400 mt-1">{scoringInfo.description}</p>
      </div>

      {/* Scoring tiers - with example indicator */}
      {scoringInfo.tiers.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Punten verdeling <span className="normal-case text-slate-600">(bijv. {exampleBasePoints} basispunten)</span>
          </p>
          <div className="bg-slate-900/50 rounded-lg overflow-hidden">
            {scoringInfo.tiers.map((tier, index) => (
              <div
                key={index}
                className={`flex items-center justify-between px-3 py-2 ${
                  index % 2 === 0 ? "bg-slate-800/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${getPercentageColor(tier.percentage)}`}>
                    {tier.percentage}%
                  </span>
                  <span className="text-sm text-slate-300">{tier.threshold}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-500 italic">
                    bijv. {calculateExamplePoints(tier.percentage)} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonuses section */}
      {showBonuses && scoringInfo.mode !== ScoringMode.NO_SCORE && (
        <div className="border-t border-slate-700 pt-3 mt-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Bonussen (indien ingeschakeld in Quiz)
          </p>
          <div className="space-y-2">
            {/* Time bonus */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>⏱️</span>
                <span className={showTimeBonusExample ? "text-slate-300" : "text-slate-500 line-through"}>
                  Snelheidsbonus
                </span>
              </div>
              <span className="text-slate-500 italic">
                Tot +{exampleTimeBonusPercentage}% (bijv. +{calculateExamplePoints(exampleTimeBonusPercentage)} pts)
              </span>
            </div>

            {/* Streak bonus */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>🔥</span>
                <span className={showStreakBonusExample ? "text-slate-300" : "text-slate-500 line-through"}>
                  Streak bonus
                </span>
              </div>
              <span className="text-slate-500 italic">
                bijv. +{exampleStreakBonusPoints} pt per reeks
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Example max points calculation */}
      {scoringInfo.mode !== ScoringMode.NO_SCORE && (
        <div className="border-t border-slate-700 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Voorbeeld maximum:</span>
            <span className="text-lg font-bold text-green-400/70 italic">
              ~{exampleBasePoints + (showTimeBonusExample ? calculateExamplePoints(exampleTimeBonusPercentage) : 0)} pts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Bijv. {exampleBasePoints} basis + {showTimeBonusExample ? `${calculateExamplePoints(exampleTimeBonusPercentage)} snelheid` : "geen bonus"}
          </p>
        </div>
      )}

      {/* Note about actual points */}
      {scoringInfo.mode !== ScoringMode.NO_SCORE && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-700">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <span>ℹ️</span>
            <span>Het werkelijke aantal punten wordt ingesteld in de Quiz instellingen.</span>
          </p>
        </div>
      )}

      {/* Poll special message */}
      {scoringInfo.mode === ScoringMode.NO_SCORE && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2">
          <p className="text-sm text-blue-300">
            💡 Bij een poll worden alle stemmen bijgehouden en getoond in een live staafdiagram.
            Spelers kunnen stemmen verdelen bekijken na sluiting.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ScoringInfoBadge({ questionType }: { questionType: string }) {
  const scoringInfo = getScoringInfo(questionType);
  
  const getBadgeColor = (mode: ScoringMode) => {
    switch (mode) {
      case ScoringMode.EXACT_MATCH:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case ScoringMode.PARTIAL_MULTI:
      case ScoringMode.PARTIAL_ORDER:
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case ScoringMode.FUZZY_TEXT:
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case ScoringMode.NUMERIC_DISTANCE:
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case ScoringMode.NO_SCORE:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor(
        scoringInfo.mode
      )}`}
      title={scoringInfo.description}
    >
      {scoringInfo.title}
    </span>
  );
}
