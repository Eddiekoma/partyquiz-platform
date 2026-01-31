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

  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Request final leaderboard
    socket.emit("GET_LEADERBOARD", {
      sessionCode: code.toUpperCase(),
    });

    // Listen for leaderboard update
    socket.on("LEADERBOARD_UPDATE", (data: any) => {
      console.log("[Results] Leaderboard:", data);
      setLeaderboard(data.leaderboard || []);

      // Find my stats
      const playerName = sessionStorage.getItem("playerName");
      if (playerName) {
        const myEntry = data.leaderboard?.find(
          (entry: LeaderboardEntry) => entry.playerName === playerName
        );
        if (myEntry) {
          setMyStats(myEntry);
          setMyRank(data.leaderboard.indexOf(myEntry) + 1);
        }
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
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          {myRank && myRank <= 3 && (
            <div className="text-6xl mb-4 animate-bounce">
              {getConfetti(myRank)}
            </div>
          )}
          <h1 className="text-5xl font-black text-white mb-4">
            Game Over!
          </h1>
          {myRank && (
            <div className="inline-block bg-white/20 backdrop-blur-sm px-8 py-4 rounded-2xl">
              <p className="text-2xl font-bold text-white mb-1">
                You finished {getRankEmoji(myRank)}
              </p>
              {myStats && (
                <p className="text-lg text-white/90">
                  {myStats.totalScore} points • {myStats.correctAnswers} correct
                </p>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 mb-6">
          <h2 className="text-2xl font-black text-white mb-4 text-center">
            🏆 Final Leaderboard
          </h2>
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-center text-white/60 py-8">
                Loading results...
              </p>
            ) : (
              leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isMe = entry.playerName === sessionStorage.getItem("playerName");

                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center gap-4 rounded-xl p-4 transition-all ${
                      isMe
                        ? "bg-purple-600 ring-4 ring-purple-300 scale-105"
                        : "bg-white/20 backdrop-blur-sm"
                    }`}
                    style={{
                      animation: `slideIn 0.4s ease-out ${index * 0.1}s both`,
                    }}
                  >
                    {/* Rank */}
                    <div className="w-16 text-center">
                      <span className="text-3xl font-black text-white">
                        {getRankEmoji(rank)}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className="text-4xl">{entry.avatar}</div>

                    {/* Name & Stats */}
                    <div className="flex-1">
                      <p className="text-xl font-black text-white">
                        {entry.playerName}
                        {isMe && " (You)"}
                      </p>
                      <p className="text-sm text-white/80">
                        {entry.correctAnswers} correct
                        {entry.maxStreak > 1 && ` • ${entry.maxStreak}x streak`}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className="text-3xl font-black text-white">
                        {entry.totalScore}
                      </p>
                      <p className="text-xs text-white/60">points</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/join")}
            className="flex-1 py-4 px-6 text-lg font-bold text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all transform hover:scale-105 active:scale-95"
          >
            Join New Game
          </button>
          <button
            onClick={() => router.push(`/play/${code}/lobby`)}
            className="flex-1 py-4 px-6 text-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 active:scale-95"
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
