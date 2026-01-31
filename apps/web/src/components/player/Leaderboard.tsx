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
}

export function Leaderboard({ sessionCode, visible = false }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("LEADERBOARD_UPDATE", (data: any) => {
      if (data.leaderboard) {
        setEntries(data.leaderboard.slice(0, 10)); // Top 10
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-3xl font-black text-gray-900 mb-6 text-center">
          🏆 Leaderboard
        </h2>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.playerId}
              className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4"
            >
              <div className="w-12 text-center">
                <span className="text-2xl font-black text-gray-700">
                  {getRankEmoji(index + 1)}
                </span>
              </div>
              <div className="text-3xl">{entry.avatar}</div>
              <div className="flex-1">
                <p className="text-lg font-bold text-gray-900">
                  {entry.playerName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-purple-600">
                  {entry.totalScore}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
