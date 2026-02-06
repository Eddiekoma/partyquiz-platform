"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";
import { SwanRace } from "@/components/SwanRace";

interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
}

interface CurrentQuestion {
  id: string;
  prompt: string;
  type: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  mediaUrl?: string;
}

interface SessionData {
  id: string;
  code: string;
  status: string;
  quiz: {
    title: string;
  };
  workspace: {
    name: string;
    logo?: string;
    themeColor?: string;
  };
  players: Player[];
}

type DisplayState = "lobby" | "question" | "locked" | "reveal" | "scoreboard" | "minigame" | "paused" | "ended";

export default function DisplayPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayState, setDisplayState] = useState<DisplayState>("lobby");
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [scoreboardData, setScoreboardData] = useState<{ type: string; players: Player[] }>({ type: "top10", players: [] });
  const [minigameType, setMinigameType] = useState<string | null>(null);

  // Use WebSocket without onMessage - we'll set up direct listeners
  const { socket, isConnected } = useWebSocket({
    sessionCode: code,
  });

  // Track if we've already joined the room
  const hasJoinedRoom = useRef(false);

  // Set up event listeners when socket connects
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Prevent multiple join emissions
    if (!hasJoinedRoom.current) {
      hasJoinedRoom.current = true;
      console.log("[Display] Socket connected, joining session room...");
      
      // Display joins the session room (as host-like viewer)
      socket.emit(WSMessageType.HOST_JOIN_SESSION, {
        sessionCode: code,
      });
    }

    // Listen for session state
    socket.on(WSMessageType.SESSION_STATE, (data: any) => {
      console.log("[Display] SESSION_STATE received:", data);
      if (data.players) {
        setSession(prev => prev ? { ...prev, players: data.players } : null);
      }
    });

    // Listen for player joined
    socket.on(WSMessageType.PLAYER_JOINED, (data: any) => {
      console.log("[Display] PLAYER_JOINED received:", data);
      if (data.player) {
        setSession(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== data.player.id), data.player]
        } : null);
      }
    });

    // Listen for player left
    socket.on(WSMessageType.PLAYER_LEFT, (data: any) => {
      console.log("[Display] PLAYER_LEFT received:", data);
      if (data.playerId) {
        setSession(prev => prev ? {
          ...prev,
          players: prev.players.filter(p => p.id !== data.playerId)
        } : null);
      }
    });

    // Listen for item started
    socket.on(WSMessageType.ITEM_STARTED, (data: any) => {
      console.log("[Display] ITEM_STARTED received:", data);
      setCurrentQuestion({
        id: data.itemId,
        prompt: data.prompt,
        type: data.questionType,
        options: data.options?.map((opt: any) => ({
          ...opt,
          isCorrect: false, // Hide correct answer on display!
        })),
        mediaUrl: data.mediaUrl,
      });
      setTimeRemaining(data.timerDuration);
      setAnsweredCount(0);
      setDisplayState("question");
    });

    // Listen for item locked
    socket.on(WSMessageType.ITEM_LOCKED, () => {
      console.log("[Display] ITEM_LOCKED");
      setDisplayState("locked");
    });

    // Listen for answer reveal
    socket.on(WSMessageType.REVEAL_ANSWERS, (data: any) => {
      console.log("[Display] REVEAL_ANSWERS:", data);
      if (data.correctOptionId) {
        setCurrentQuestion(prev => prev ? {
          ...prev,
          options: prev.options?.map(opt => ({
            ...opt,
            isCorrect: opt.id === data.correctOptionId,
          })),
        } : null);
      }
      setDisplayState("reveal");
    });

    // Listen for answer received
    socket.on(WSMessageType.ANSWER_RECEIVED, () => {
      setAnsweredCount(prev => prev + 1);
    });

    // Listen for scoreboard
    socket.on("SHOW_SCOREBOARD", (data: any) => {
      console.log("[Display] SHOW_SCOREBOARD:", data);
      setScoreboardData({
        type: data.displayType || "top10",
        players: session?.players.sort((a, b) => b.score - a.score) || [],
      });
      setDisplayState("scoreboard");
    });

    // Listen for swan race
    socket.on(WSMessageType.SWAN_RACE_STARTED, () => {
      console.log("[Display] SWAN_RACE_STARTED");
      setMinigameType("SWAN_RACE");
      setDisplayState("minigame");
    });

    // Listen for session pause/resume/end
    socket.on(WSMessageType.SESSION_PAUSED, () => {
      setDisplayState("paused");
    });

    socket.on(WSMessageType.SESSION_RESUMED, () => {
      if (currentQuestion) {
        setDisplayState("question");
      } else {
        setDisplayState("lobby");
      }
    });

    socket.on(WSMessageType.SESSION_ENDED, () => {
      setDisplayState("ended");
    });

    // Cleanup listeners
    return () => {
      socket.off(WSMessageType.SESSION_STATE);
      socket.off(WSMessageType.PLAYER_JOINED);
      socket.off(WSMessageType.PLAYER_LEFT);
      socket.off(WSMessageType.ITEM_STARTED);
      socket.off(WSMessageType.ITEM_LOCKED);
      socket.off(WSMessageType.REVEAL_ANSWERS);
      socket.off(WSMessageType.ANSWER_RECEIVED);
      socket.off("SHOW_SCOREBOARD");
      socket.off(WSMessageType.SWAN_RACE_STARTED);
      socket.off(WSMessageType.SESSION_PAUSED);
      socket.off(WSMessageType.SESSION_RESUMED);
      socket.off(WSMessageType.SESSION_ENDED);
    };
  }, [socket, isConnected, code, session, currentQuestion, hasJoinedRoom]);

  // Fetch session data
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions/code/${code}`);
        if (!response.ok) return;
        const data = await response.json();
        setSession(data.session);
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [code]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || displayState !== "question") {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, displayState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Session not found</div>
      </div>
    );
  }

  const themeColor = session.workspace.themeColor || "#6366f1";
  const joinUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/play/${code}` 
    : `/play/${code}`;

  return (
    <div 
      className="min-h-screen text-white overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${themeColor}22 0%, #0f172a 50%, #0f172a 100%)` 
      }}
    >
      {/* Header - Always visible */}
      <header className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          {session.workspace.logo && (
            <img 
              src={session.workspace.logo} 
              alt={session.workspace.name}
              className="h-12 w-12 rounded-xl object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{session.quiz.title}</h1>
            <p className="text-slate-400">{session.workspace.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur px-4 py-2 rounded-lg">
            <span className="text-slate-400">👥</span>
            <span className="font-bold text-xl">{session.players.length}</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center pt-20 pb-8 px-8">
        
        {/* LOBBY STATE */}
        {displayState === "lobby" && (
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-12">
              <p className="text-2xl text-slate-400 mb-4">Join with code</p>
              <p 
                className="text-8xl font-mono font-bold tracking-[0.3em]"
                style={{ color: themeColor }}
              >
                {code}
              </p>
              <p className="text-xl text-slate-500 mt-4">{joinUrl}</p>
            </div>

            {/* Player Grid */}
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {session.players.map((player) => (
                <div 
                  key={player.id}
                  className="bg-slate-800/50 backdrop-blur rounded-xl p-4 text-center animate-fadeIn"
                >
                  <div className="text-3xl mb-2">{player.avatar || "👤"}</div>
                  <p className="font-medium text-sm truncate">{player.name}</p>
                </div>
              ))}
            </div>

            {session.players.length === 0 && (
              <p className="text-xl text-slate-500 mt-8">Waiting for players to join...</p>
            )}
          </div>
        )}

        {/* QUESTION STATE */}
        {(displayState === "question" || displayState === "locked" || displayState === "reveal") && currentQuestion && (
          <div className="w-full max-w-6xl mx-auto">
            {/* Timer */}
            {displayState === "question" && timeRemaining !== null && (
              <div className="text-center mb-8">
                <div 
                  className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-4xl font-bold ${
                    timeRemaining <= 5 ? "bg-red-600 animate-pulse" : "bg-slate-800"
                  }`}
                >
                  {timeRemaining}
                </div>
              </div>
            )}

            {/* Question */}
            <div className="bg-slate-800/80 backdrop-blur rounded-3xl p-8 mb-8">
              <h2 className="text-4xl md:text-5xl font-bold text-center leading-tight">
                {currentQuestion.prompt}
              </h2>
            </div>

            {/* Options */}
            {currentQuestion.options && (
              <div className="grid grid-cols-2 gap-6">
                {currentQuestion.options.map((option, idx) => {
                  const colors = [
                    { bg: "bg-red-600", hover: "hover:bg-red-500" },
                    { bg: "bg-blue-600", hover: "hover:bg-blue-500" },
                    { bg: "bg-yellow-600", hover: "hover:bg-yellow-500" },
                    { bg: "bg-green-600", hover: "hover:bg-green-500" },
                  ];
                  const color = colors[idx % 4];
                  
                  return (
                    <div 
                      key={option.id}
                      className={`p-6 rounded-2xl text-2xl font-bold transition-all ${
                        displayState === "reveal" && option.isCorrect 
                          ? "bg-green-500 ring-4 ring-green-300 scale-105"
                          : color.bg
                      }`}
                    >
                      <span className="opacity-70 mr-4">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {option.text}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Answer Progress */}
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-4 bg-slate-800/80 backdrop-blur px-6 py-3 rounded-full">
                <span className="text-slate-400">Answered:</span>
                <span className="text-3xl font-bold">{answeredCount}</span>
                <span className="text-slate-400">/ {session.players.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* SCOREBOARD STATE */}
        {displayState === "scoreboard" && (
          <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold text-center mb-12">🏆 Scoreboard</h2>
            
            <div className="space-y-4">
              {session.players
                .sort((a, b) => b.score - a.score)
                .slice(0, scoreboardData.type === "top3" ? 3 : scoreboardData.type === "top5" ? 5 : 10)
                .map((player, index) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const isTopThree = index < 3;
                  
                  return (
                    <div 
                      key={player.id}
                      className={`flex items-center gap-6 p-6 rounded-2xl transition-all ${
                        isTopThree 
                          ? "bg-gradient-to-r from-slate-800 to-slate-700 scale-105" 
                          : "bg-slate-800/50"
                      }`}
                      style={{
                        animationDelay: `${index * 100}ms`,
                      }}
                    >
                      <span className="text-4xl font-bold w-16 text-center">
                        {index < 3 ? medals[index] : index + 1}
                      </span>
                      <span className="text-4xl">{player.avatar || "👤"}</span>
                      <span className="flex-1 text-2xl font-bold">{player.name}</span>
                      <span 
                        className="text-4xl font-mono font-bold"
                        style={{ color: themeColor }}
                      >
                        {player.score}
                      </span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

        {/* MINIGAME STATE - Swan Race */}
        {displayState === "minigame" && minigameType === "SWAN_RACE" && (
          <div className="w-full max-w-6xl mx-auto">
            <h2 className="text-5xl font-bold text-center mb-8">🦢 Swan Race</h2>
            {/* Swan Race display component would go here */}
            <div className="bg-slate-800/80 backdrop-blur rounded-3xl p-8 min-h-[400px] flex items-center justify-center">
              <p className="text-2xl text-slate-400">Swan Race in progress...</p>
            </div>
          </div>
        )}

        {/* PAUSED STATE */}
        {displayState === "paused" && (
          <div className="text-center">
            <div className="text-8xl mb-8">⏸️</div>
            <h2 className="text-5xl font-bold mb-4">Game Paused</h2>
            <p className="text-2xl text-slate-400">Waiting for host to resume...</p>
          </div>
        )}

        {/* ENDED STATE */}
        {displayState === "ended" && (
          <div className="w-full max-w-4xl mx-auto text-center">
            <div className="text-8xl mb-8">🎉</div>
            <h2 className="text-5xl font-bold mb-12">Game Over!</h2>
            
            {/* Top 3 Winners */}
            <div className="flex justify-center items-end gap-8 mb-12">
              {session.players
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((player, index) => {
                  const heights = ["h-48", "h-40", "h-32"];
                  const positions = [1, 0, 2]; // 2nd, 1st, 3rd for podium order
                  const medals = ["🥇", "🥈", "🥉"];
                  const actualIndex = positions[index];
                  const actualPlayer = session.players.sort((a, b) => b.score - a.score)[actualIndex];
                  
                  if (!actualPlayer) return null;
                  
                  return (
                    <div key={actualPlayer.id} className="text-center">
                      <div className="text-6xl mb-4">{actualPlayer.avatar || "👤"}</div>
                      <p className="text-2xl font-bold mb-2">{actualPlayer.name}</p>
                      <p className="text-xl text-slate-400 mb-4">{actualPlayer.score} pts</p>
                      <div 
                        className={`${heights[actualIndex]} w-32 rounded-t-xl flex items-start justify-center pt-4`}
                        style={{ backgroundColor: themeColor }}
                      >
                        <span className="text-5xl">{medals[actualIndex]}</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            <p className="text-xl text-slate-400">Thanks for playing!</p>
          </div>
        )}
      </main>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
