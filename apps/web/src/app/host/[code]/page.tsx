"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";
import Link from "next/link";
import QRCode from "react-qr-code";

interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isOnline: boolean;
}

interface QuizItem {
  id: string;
  order: number;
  itemType: "QUESTION" | "MINIGAME" | "SCOREBOARD" | "BREAK";
  question?: {
    id: string;
    title: string;
    prompt: string;
    type: string;
    options?: { id: string; text: string; isCorrect: boolean }[];
  };
  minigameType?: string;
  settingsJson?: any;
}

interface Round {
  id: string;
  title: string;
  order: number;
  items: QuizItem[];
}

interface SessionData {
  id: string;
  code: string;
  status: string;
  workspaceId: string;
  quiz: {
    id: string;
    title: string;
    description?: string;
    rounds: Round[];
  };
  workspace: {
    name: string;
    logo?: string;
    themeColor?: string;
  };
  players: Player[];
}

export default function HostControlPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [itemState, setItemState] = useState<"idle" | "active" | "locked" | "revealed">("idle");
  const [answeredCount, setAnsweredCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  // Use WebSocket without onMessage - we'll set up direct listeners
  const { socket, isConnected, send } = useWebSocket({
    sessionCode: code,
  });

  // Join session room and set up event listeners when socket connects
  useEffect(() => {
    if (!socket || !isConnected || hasJoinedRoom) return;

    console.log("[Host] Socket connected, joining session room...");
    
    // Host joins the session room
    socket.emit(WSMessageType.HOST_JOIN_SESSION, {
      sessionCode: code,
    });
    
    // Mark as joined to prevent re-joining
    setHasJoinedRoom(true);

    // Listen for session state (sent after joining)
    const handleSessionState = (data: any) => {
      console.log("[Host] SESSION_STATE received:", data);
      if (data.players) {
        setSession(prev => prev ? { ...prev, players: data.players } : null);
      }
    };

    // Listen for player joined
    const handlePlayerJoined = (data: any) => {
      console.log("[Host] PLAYER_JOINED received:", data);
      if (data.player) {
        setSession(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== data.player.id), data.player]
        } : null);
      }
    };

    // Listen for player left
    const handlePlayerLeft = (data: any) => {
      console.log("[Host] PLAYER_LEFT received:", data);
      if (data.playerId) {
        setSession(prev => prev ? {
          ...prev,
          players: prev.players.filter(p => p.id !== data.playerId)
        } : null);
      }
    };

    // Listen for answer received
    const handleAnswerReceived = (data: any) => {
      console.log("[Host] ANSWER_RECEIVED:", data);
      setAnsweredCount(prev => prev + 1);
    };

    // Listen for session ended
    const handleSessionEnded = () => {
      console.log("[Host] SESSION_ENDED");
      setSession(prev => prev ? { ...prev, status: "ENDED" } : null);
    };

    // Listen for session reset
    const handleSessionReset = (data: any) => {
      console.log("[Host] SESSION_RESET received:", data);
      // Reset local state
      setCurrentItemIndex(0);
      setItemState("idle");
      setAnsweredCount(0);
      setIsPaused(false);
      // Update session status
      setSession(prev => prev ? { 
        ...prev, 
        status: "LOBBY",
        players: data.players || prev.players 
      } : null);
    };

    // Listen for errors
    const handleError = (data: any) => {
      console.error("[Host] WS Error:", data);
    };

    // Set up all listeners
    socket.on(WSMessageType.SESSION_STATE, handleSessionState);
    socket.on(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
    socket.on(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
    socket.on(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
    socket.on(WSMessageType.SESSION_ENDED, handleSessionEnded);
    socket.on(WSMessageType.SESSION_RESET, handleSessionReset);
    socket.on(WSMessageType.ERROR, handleError);

    // Cleanup listeners on unmount
    return () => {
      socket.off(WSMessageType.SESSION_STATE, handleSessionState);
      socket.off(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
      socket.off(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
      socket.off(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
      socket.off(WSMessageType.SESSION_ENDED, handleSessionEnded);
      socket.off(WSMessageType.SESSION_RESET, handleSessionReset);
      socket.off(WSMessageType.ERROR, handleError);
    };
  }, [socket, isConnected, code, router, hasJoinedRoom]);

  // Fetch session data
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions/code/${code}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Session not found");
          } else {
            setError("Failed to load session");
          }
          return;
        }
        const data = await response.json();
        setSession(data.session);
      } catch (err) {
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [code]);

  // Flatten items for navigation
  const allItems = session?.quiz.rounds.flatMap(round => 
    round.items.map(item => ({ ...item, roundTitle: round.title }))
  ) || [];
  
  const currentItem = allItems[currentItemIndex];
  const totalItems = allItems.length;

  // Host controls
  const startItem = useCallback(() => {
    if (!currentItem) return;
    
    send({
      type: WSMessageType.START_ITEM,
      timestamp: Date.now(),
      payload: {
        sessionCode: code,
        itemId: currentItem.id,
        itemType: currentItem.itemType,
        timerDuration: currentItem.settingsJson?.timer || 30,
      },
    });
    
    setItemState("active");
    setAnsweredCount(0);
  }, [currentItem, code, send]);

  const lockItem = useCallback(() => {
    send({
      type: WSMessageType.LOCK_ITEM,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setItemState("locked");
  }, [code, send]);

  const revealAnswers = useCallback(() => {
    send({
      type: WSMessageType.REVEAL_ANSWERS,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setItemState("revealed");
  }, [code, send]);

  const nextItem = useCallback(() => {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(prev => prev + 1);
      setItemState("idle");
      setAnsweredCount(0);
    }
  }, [currentItemIndex, totalItems]);

  const previousItem = useCallback(() => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
      setItemState("idle");
      setAnsweredCount(0);
    }
  }, [currentItemIndex]);

  const startSwanRace = useCallback(() => {
    send({
      type: WSMessageType.START_SWAN_RACE,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setItemState("active");
  }, [code, send]);

  const showScoreboard = useCallback(() => {
    send({
      type: "SHOW_SCOREBOARD" as any,
      timestamp: Date.now(),
      payload: { 
        sessionCode: code,
        displayType: currentItem?.settingsJson?.displayType || "top10",
      },
    });
    setItemState("active");
  }, [code, currentItem, send]);

  const pauseSession = useCallback(() => {
    send({
      type: WSMessageType.PAUSE_SESSION,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setIsPaused(true);
  }, [code, send]);

  const resumeSession = useCallback(() => {
    send({
      type: WSMessageType.RESUME_SESSION,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setIsPaused(false);
  }, [code, send]);

  const endSession = useCallback(() => {
    if (confirm("Are you sure you want to end this session?")) {
      send({
        type: WSMessageType.END_SESSION,
        timestamp: Date.now(),
        payload: { sessionCode: code },
      });
    }
  }, [code, send]);

  const resetSession = useCallback(() => {
    if (confirm("Reset this session? All answers will be cleared and players can rejoin.")) {
      send({
        type: WSMessageType.RESET_SESSION,
        timestamp: Date.now(),
        payload: { sessionCode: code },
      });
    }
  }, [code, send]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{error || "Session not found"}</h1>
          <Link href="/dashboard" className="text-primary-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const themeColor = session.workspace.themeColor || "#6366f1";
  const joinUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/play/${code}` 
    : `/play/${code}`;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back to Quiz Button */}
            <Link
              href={`/dashboard/workspaces/${session.workspaceId}/quizzes/${session.quiz.id}`}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Back to Quiz Editor"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            
            {session.workspace.logo && (
              <img 
                src={session.workspace.logo} 
                alt={session.workspace.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-bold">{session.quiz.title}</h1>
              <p className="text-sm text-slate-400">{session.workspace.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Session Status */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              session.status === "ENDED" 
                ? "bg-red-900/50 text-red-400"
                : session.status === "LOBBY"
                  ? "bg-blue-900/50 text-blue-400"
                  : "bg-green-900/50 text-green-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                session.status === "ENDED" 
                  ? "bg-red-400"
                  : session.status === "LOBBY"
                    ? "bg-blue-400"
                    : "bg-green-400"
              }`} />
              {session.status === "ENDED" ? "Ended" : session.status === "LOBBY" ? "Lobby" : "Live"}
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </div>
            
            <Link 
              href={`/display/${code}`}
              target="_blank"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              📺 Open Display
            </Link>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Players & Join Info */}
        <aside className="w-80 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
          {/* Join Info */}
          <div className="bg-slate-700 rounded-lg p-4 mb-6">
            <div className="text-center mb-3">
              <p className="text-sm text-slate-400 mb-1">Join Code</p>
              <p className="text-4xl font-mono font-bold tracking-widest" style={{ color: themeColor }}>
                {code}
              </p>
            </div>
            
            <div className="bg-white p-3 rounded-lg mb-3">
              <QRCode value={joinUrl} size={200} className="w-full h-auto" />
            </div>
            
            <p className="text-xs text-slate-400 text-center break-all">{joinUrl}</p>
            
            {/* Dev Tools - Quick Player Access */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 pt-4 border-t border-slate-600">
                <p className="text-xs text-slate-500 text-center mb-2">🛠️ Dev Tools</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(joinUrl, "_blank")}
                    className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium transition-colors"
                    title="Open player view in new tab"
                  >
                    👤 New Tab
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/dev/open-incognito", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: joinUrl }),
                        });
                        if (!res.ok) {
                          // Fallback: copy command to clipboard
                          const command = `open -na "Google Chrome" --args --incognito "${joinUrl}"`;
                          await navigator.clipboard.writeText(command);
                          alert("Could not open automatically. Command copied to clipboard!");
                        }
                      } catch (e) {
                        console.error("Error opening incognito:", e);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs font-medium transition-colors"
                    title="Open player view in incognito Chrome"
                  >
                    🕵️ Incognito
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Players List */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">
              Players ({session.players.length})
            </h3>
            
            {session.players.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Waiting for players to join...
              </p>
            ) : (
              <div className="space-y-2">
                {session.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div 
                      key={player.id}
                      className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-lg font-bold text-slate-500 w-6">
                        {index + 1}
                      </span>
                      <span className="text-xl">{player.avatar || "👤"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{player.name}</p>
                      </div>
                      <span className="font-mono font-bold" style={{ color: themeColor }}>
                        {player.score}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        player.isOnline ? "bg-green-400" : "bg-slate-500"
                      }`} />
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Current Item & Controls */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">
                Item {currentItemIndex + 1} of {totalItems}
              </span>
              <span className="text-sm text-slate-400">
                {currentItem?.roundTitle}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${((currentItemIndex + 1) / totalItems) * 100}%`,
                  backgroundColor: themeColor 
                }}
              />
            </div>
          </div>

          {/* Current Item Display */}
          {currentItem && (
            <div className="bg-slate-800 rounded-xl p-6 mb-6">
              {/* Item Type Badge */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentItem.itemType === "QUESTION" ? "bg-blue-900/50 text-blue-400" :
                  currentItem.itemType === "MINIGAME" ? "bg-purple-900/50 text-purple-400" :
                  currentItem.itemType === "SCOREBOARD" ? "bg-yellow-900/50 text-yellow-400" :
                  "bg-slate-700 text-slate-400"
                }`}>
                  {currentItem.itemType === "QUESTION" && "📝 Question"}
                  {currentItem.itemType === "MINIGAME" && `🎮 ${currentItem.minigameType || "Minigame"}`}
                  {currentItem.itemType === "SCOREBOARD" && "📊 Scoreboard"}
                  {currentItem.itemType === "BREAK" && "☕ Break"}
                </span>
                
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  itemState === "idle" ? "bg-slate-700 text-slate-400" :
                  itemState === "active" ? "bg-green-900/50 text-green-400" :
                  itemState === "locked" ? "bg-orange-900/50 text-orange-400" :
                  "bg-blue-900/50 text-blue-400"
                }`}>
                  {itemState === "idle" && "Ready"}
                  {itemState === "active" && "Active"}
                  {itemState === "locked" && "Locked"}
                  {itemState === "revealed" && "Revealed"}
                </span>
              </div>

              {/* Question Content */}
              {currentItem.itemType === "QUESTION" && currentItem.question && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">{currentItem.question.prompt}</h2>
                  
                  {currentItem.question.options && (
                    <div className="grid grid-cols-2 gap-3">
                      {currentItem.question.options.map((option, idx) => (
                        <div 
                          key={option.id}
                          className={`p-4 rounded-lg border-2 ${
                            itemState === "revealed" && option.isCorrect 
                              ? "border-green-500 bg-green-900/30" 
                              : "border-slate-600 bg-slate-700/50"
                          }`}
                        >
                          <span className="font-bold mr-2">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {option.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer Count */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="bg-slate-700 rounded-lg px-4 py-2">
                      <span className="text-slate-400 text-sm">Answered: </span>
                      <span className="font-bold text-lg">{answeredCount}</span>
                      <span className="text-slate-400">/{session.players.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Minigame Content */}
              {currentItem.itemType === "MINIGAME" && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🦢</div>
                  <h2 className="text-2xl font-bold mb-2">
                    {currentItem.minigameType === "SWAN_RACE" ? "Swan Race" : currentItem.minigameType}
                  </h2>
                  <p className="text-slate-400">
                    Players will race their swans to the finish line!
                  </p>
                </div>
              )}

              {/* Scoreboard Content */}
              {currentItem.itemType === "SCOREBOARD" && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📊</div>
                  <h2 className="text-2xl font-bold mb-2">Scoreboard</h2>
                  <p className="text-slate-400">
                    Show {currentItem.settingsJson?.displayType || "top 10"} players
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Controls</h3>
            
            <div className="flex flex-wrap gap-3">
              {/* Navigation */}
              <button
                onClick={previousItem}
                disabled={currentItemIndex === 0}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                ← Previous
              </button>
              
              <button
                onClick={nextItem}
                disabled={currentItemIndex >= totalItems - 1}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Next →
              </button>

              <div className="w-px bg-slate-600 mx-2" />

              {/* Item Controls */}
              {currentItem?.itemType === "QUESTION" && (
                <>
                  {itemState === "idle" && (
                    <button
                      onClick={startItem}
                      className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
                    >
                      ▶️ Start Question
                    </button>
                  )}
                  
                  {itemState === "active" && (
                    <button
                      onClick={lockItem}
                      className="px-6 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors"
                    >
                      🔒 Lock Answers
                    </button>
                  )}
                  
                  {itemState === "locked" && (
                    <button
                      onClick={revealAnswers}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                    >
                      👁️ Reveal Answer
                    </button>
                  )}
                </>
              )}

              {currentItem?.itemType === "MINIGAME" && currentItem.minigameType === "SWAN_RACE" && (
                <button
                  onClick={startSwanRace}
                  disabled={itemState === "active"}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  🦢 Start Swan Race
                </button>
              )}

              {currentItem?.itemType === "SCOREBOARD" && (
                <button
                  onClick={showScoreboard}
                  disabled={itemState === "active"}
                  className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  📊 Show Scoreboard
                </button>
              )}

              <div className="w-px bg-slate-600 mx-2" />

              {/* Session Controls */}
              {isPaused ? (
                <button
                  onClick={resumeSession}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
                >
                  ▶️ Resume
                </button>
              ) : (
                <button
                  onClick={pauseSession}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium transition-colors"
                >
                  ⏸️ Pause
                </button>
              )}
              
              {session.status === "ENDED" ? (
                <button
                  onClick={resetSession}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                >
                  🔄 Restart Session
                </button>
              ) : (
                <button
                  onClick={endSession}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
                >
                  🛑 End Session
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Right Sidebar - Quiz Overview */}
        <aside className="w-72 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">
            Quiz Structure
          </h3>
          
          <div className="space-y-4">
            {session.quiz.rounds.map((round, roundIndex) => (
              <div key={round.id}>
                <h4 className="font-medium text-sm mb-2">
                  Round {roundIndex + 1}: {round.title}
                </h4>
                <div className="space-y-1">
                  {round.items.map((item, itemIndex) => {
                    const globalIndex = allItems.findIndex(i => i.id === item.id);
                    const isActive = globalIndex === currentItemIndex;
                    const isPast = globalIndex < currentItemIndex;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentItemIndex(globalIndex);
                          setItemState("idle");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive 
                            ? "bg-primary-600 text-white" 
                            : isPast 
                              ? "bg-slate-700/50 text-slate-400"
                              : "bg-slate-700/30 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        <span className="mr-2">
                          {item.itemType === "QUESTION" && "📝"}
                          {item.itemType === "MINIGAME" && "🎮"}
                          {item.itemType === "SCOREBOARD" && "📊"}
                          {item.itemType === "BREAK" && "☕"}
                        </span>
                        {item.itemType === "QUESTION" && item.question?.title}
                        {item.itemType === "MINIGAME" && (item.minigameType || "Minigame")}
                        {item.itemType === "SCOREBOARD" && "Scoreboard"}
                        {item.itemType === "BREAK" && "Break"}
                        {isPast && <span className="ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
