"use client";

import { useEffect, useState } from "react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface PollResultsData {
  itemId: string;
  results: Record<string, number>;
  totalVotes: number;
  options: PollOption[];
}

interface PollResultsProps {
  data?: PollResultsData;
  showVoteCounts?: boolean;
  showPercentages?: boolean;
  animated?: boolean;
}

/**
 * PollResults - Displays live poll results as an animated bar chart
 */
export function PollResults({
  data,
  showVoteCounts = true,
  showPercentages = true,
  animated = true,
}: PollResultsProps) {
  const [animatedPercentages, setAnimatedPercentages] = useState<Record<string, number>>({});

  // Animate percentages when data changes
  useEffect(() => {
    if (!data || !animated) {
      setAnimatedPercentages(
        data?.options.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.percentage }), {}) || {}
      );
      return;
    }

    // Animate each bar
    const duration = 500; // ms
    const startTime = Date.now();
    const startValues = { ...animatedPercentages };
    const targetValues = data.options.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.percentage }), {});

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const current: Record<string, number> = {};
      for (const optId of Object.keys(targetValues)) {
        const start = startValues[optId] || 0;
        const end = (targetValues as Record<string, number>)[optId];
        current[optId] = Math.round(start + (end - start) * eased);
      }
      
      setAnimatedPercentages(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [data, animated]);

  // Get color for bar based on index
  const getBarColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-cyan-500",
      "bg-yellow-500",
      "bg-red-500",
    ];
    return colors[index % colors.length];
  };

  if (!data || data.options.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
        <p className="text-slate-400">Wachten op stemmen...</p>
      </div>
    );
  }

  // Sort options by votes (highest first)
  const sortedOptions = [...data.options].sort((a, b) => b.votes - a.votes);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🗳️</span>
          Poll Resultaten
        </h3>
        <span className="text-sm text-slate-400">
          {data.totalVotes} {data.totalVotes === 1 ? "stem" : "stemmen"}
        </span>
      </div>

      {/* Bar Chart */}
      <div className="space-y-4">
        {sortedOptions.map((option, index) => {
          const percentage = animatedPercentages[option.id] ?? option.percentage;
          const isWinner = index === 0 && data.totalVotes > 0;

          return (
            <div key={option.id} className="space-y-2">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isWinner ? "text-white font-semibold" : "text-slate-300"}`}>
                  {isWinner && "👑 "}
                  {option.text}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  {showVoteCounts && (
                    <span className="text-slate-400">
                      {option.votes} {option.votes === 1 ? "stem" : "stemmen"}
                    </span>
                  )}
                  {showPercentages && (
                    <span className={`font-mono ${isWinner ? "text-white" : "text-slate-500"}`}>
                      {percentage}%
                    </span>
                  )}
                </div>
              </div>

              {/* Bar */}
              <div className="h-8 bg-slate-700/50 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${getBarColor(index)} transition-all duration-300 ease-out flex items-center`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                >
                  {percentage >= 15 && (
                    <span className="text-white text-xs font-semibold px-3">
                      {percentage}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {data.totalVotes === 0 && (
        <p className="text-center text-slate-500 text-sm mt-4">
          Nog geen stemmen ontvangen
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function PollResultsCompact({ data }: { data?: PollResultsData }) {
  if (!data || data.options.length === 0) {
    return <span className="text-slate-500">Geen stemmen</span>;
  }

  const winner = [...data.options].sort((a, b) => b.votes - a.votes)[0];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">{data.totalVotes} stemmen</span>
      <span className="text-slate-600">•</span>
      <span className="text-slate-300">
        👑 {winner.text} ({winner.percentage}%)
      </span>
    </div>
  );
}
