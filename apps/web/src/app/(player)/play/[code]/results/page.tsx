"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  totalScore: number;
  correctAnswers: number;
  maxStreak: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myStats, setMyStats] = useState<LeaderboardEntry | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { socket, isConnected } = useWebSocket();

  // Get player info from localStorage
  useEffect(() => {
    const storedPlayer = localStorage.getItem(`player-${code.toUpperCase()}`);
    if (storedPlayer) {
      const player = JSON.parse(storedPlayer);
      setPlayerId(player.id);
    }

    // Check for cached leaderboard from SESSION_ENDED event (immediate display)
    const cachedLeaderboard = sessionStorage.getItem(`finalLeaderboard-${code.toUpperCase()}`);
    if (cachedLeaderboard) {
      try {
        const parsed = JSON.parse(cachedLeaderboard);
        console.log("[Results] Using cached leaderboard:", parsed);
        updateLeaderboardState(parsed);
      } catch (e) {
        console.error("[Results] Failed to parse cached leaderboard:", e);
      }
    }
  }, [code]);

  // Helper function to update leaderboard state
  const updateLeaderboardState = (data: LeaderboardEntry[]) => {
    setLeaderboard(data);

    // Find my stats - try by playerId first, then by name
    const storedPlayer = localStorage.getItem(`player-${code.toUpperCase()}`);
    const myPlayerId = storedPlayer ? JSON.parse(storedPlayer).id : null;
    const playerName = sessionStorage.getItem("playerName");

    let myEntry = null;
    if (myPlayerId) {
      myEntry = data.find((entry: LeaderboardEntry) => entry.playerId === myPlayerId);
    }
    if (!myEntry && playerName) {
      myEntry = data.find((entry: LeaderboardEntry) => entry.playerName === playerName);
    }

    if (myEntry) {
      setMyStats(myEntry);
      setMyRank(data.indexOf(myEntry) + 1);
    }
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Request final leaderboard (will update/replace cached data)
    socket.emit("GET_LEADERBOARD", {
      sessionCode: code.toUpperCase(),
    });

    // Listen for leaderboard update
    socket.on("LEADERBOARD_UPDATE", (data: any) => {
      console.log("[Results] Leaderboard from server:", data);
      if (data.leaderboard) {
        updateLeaderboardState(data.leaderboard);
      }
    });

    return () => {
      socket.off("LEADERBOARD_UPDATE");
    };
  }, [socket, isConnected, code]);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getConfetti = (rank: number) => {
    if (rank === 1) return "🎉🎊🏆🎉🎊";
    if (rank === 2) return "🎉🎊🎉";
    if (rank === 3) return "🎉";
    return "";
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-3 sm:px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-5 sm:mb-8">
          {myRank && myRank <= 3 && (
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4 animate-bounce">
              {getConfetti(myRank)}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-3 sm:mb-4">
            Game Over!
          </h1>
          {myRank && (
            <div className="inline-block bg-white/20 backdrop-blur-sm px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl">
              <p className="text-lg sm:text-2xl font-bold text-white mb-0.5 sm:mb-1">
                You finished {getRankEmoji(myRank)}
              </p>
              {myStats && (
                <p className="text-base sm:text-lg text-white/90">
                  {myStats.totalScore} points
                </p>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-black text-white mb-3 sm:mb-4 text-center">
            🏆 Final Leaderboard
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-center text-white/60 py-6 sm:py-8 text-sm sm:text-base">
                Loading results...
              </p>
            ) : (
              leaderboard.map((entry, index) => {
                const rank = index + 1;
                // Check by playerId first (more reliable), then by name
                const storedPlayer = localStorage.getItem(`player-${code.toUpperCase()}`);
                const myPlayerId = storedPlayer ? JSON.parse(storedPlayer).id : null;
                const isMe = myPlayerId ? entry.playerId === myPlayerId : entry.playerName === sessionStorage.getItem("playerName");

                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center gap-2 sm:gap-4 rounded-lg sm:rounded-xl p-2.5 sm:p-4 transition-all ${
                      isMe
                        ? "bg-purple-600 ring-2 sm:ring-4 ring-purple-300"
                        : "bg-white/20 backdrop-blur-sm"
                    }`}
                    style={{
                      animation: `slideIn 0.4s ease-out ${index * 0.1}s both`,
                    }}
                  >
                    {/* Rank */}
                    <div className="w-10 sm:w-16 text-center flex-shrink-0">
                      <span className="text-xl sm:text-3xl font-black text-white">
                        {getRankEmoji(rank)}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className="text-2xl sm:text-4xl flex-shrink-0">{entry.avatar}</div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-xl font-black text-white truncate">
                        {entry.playerName}
                        {isMe && " (You)"}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg sm:text-3xl font-black text-white">
                        {entry.totalScore}
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/60">points</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <button
            onClick={() => router.push("/join")}
            className="flex-1 py-3 sm:py-4 px-4 sm:px-6 text-base sm:text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all active:scale-95"
          >
            Join New Game
          </button>
          <button
            onClick={() => router.push(`/play/${code}/lobby`)}
            className="flex-1 py-3 sm:py-4 px-4 sm:px-6 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all active:scale-95"
          >
            Play Again
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
