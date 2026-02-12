"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  totalScore: number;
}

interface LeaderboardProps {
  sessionCode: string;
  visible?: boolean;
  entries?: LeaderboardEntry[];
  currentPlayerId?: string;
}

export function Leaderboard({ 
  sessionCode, 
  visible = false, 
  entries: propEntries,
  currentPlayerId 
}: LeaderboardProps) {
  const [internalEntries, setInternalEntries] = useState<LeaderboardEntry[]>([]);
  const { socket, isConnected } = useWebSocket();

  // Use prop entries if provided, otherwise use internal state
  const entries = propEntries || internalEntries;

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("LEADERBOARD_UPDATE", (data: any) => {
      if (data.leaderboard) {
        setInternalEntries(data.leaderboard.slice(0, 10)); // Top 10
      }
    });

    return () => {
      socket.off("LEADERBOARD_UPDATE");
    };
  }, [socket, isConnected]);

  if (!visible || entries.length === 0) return null;

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}.`;
  };

  // Find current player's rank
  const currentPlayerRank = entries.findIndex(e => e.playerId === currentPlayerId) + 1;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 safe-area-inset">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-4 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="text-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-black text-white flex items-center justify-center gap-2">
            <span className="text-3xl">🏆</span> Leaderboard
          </h2>
          {currentPlayerId && currentPlayerRank > 0 && (
            <p className="text-sm text-purple-300 mt-1">
              You are in <span className="font-bold text-white">#{currentPlayerRank}</span> place
            </p>
          )}
        </div>
        
        {/* Scrollable entries */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
          {entries.map((entry, index) => {
            const isCurrentPlayer = entry.playerId === currentPlayerId;
            const rank = index + 1;
            
            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                  isCurrentPlayer 
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 ring-2 ring-purple-400 scale-[1.02] shadow-lg shadow-purple-500/30" 
                    : rank <= 3
                      ? "bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border border-yellow-500/30"
                      : "bg-slate-700/50"
                }`}
              >
                {/* Rank */}
                <div className="w-10 text-center flex-shrink-0">
                  <span className={`text-xl font-black ${
                    rank === 1 ? "text-yellow-400" :
                    rank === 2 ? "text-gray-300" :
                    rank === 3 ? "text-amber-600" :
                    "text-slate-400"
                  }`}>
                    {getRankEmoji(rank)}
                  </span>
                </div>
                
                {/* Avatar */}
                <div className="text-2xl flex-shrink-0">{entry.avatar}</div>
                
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${
                    isCurrentPlayer ? "text-white" : "text-white/90"
                  }`}>
                    {entry.playerName}
                    {isCurrentPlayer && <span className="ml-1 text-xs">(You)</span>}
                  </p>
                </div>
                
                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-xl font-black ${
                    isCurrentPlayer ? "text-white" : "text-purple-400"
                  }`}>
                    {entry.totalScore.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Footer - waiting message */}
        <div className="mt-4 text-center flex-shrink-0">
          <p className="text-sm text-slate-400 animate-pulse">
            Waiting for host to continue...
          </p>
        </div>
      </div>
    </div>
  );
}
