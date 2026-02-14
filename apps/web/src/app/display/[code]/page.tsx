"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType } from "@partyquiz/shared";
import { SwanRace } from "@/components/SwanRace";
import { SwanChaseDisplay } from "@/components/SwanChaseDisplay";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";
import { PhotoGrid } from "@/components/PhotoGrid";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import QRCode from "react-qr-code";

interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
}

interface QuestionMedia {
  id: string;
  url: string;
  type: string;
  width?: number | null;
  height?: number | null;
  displayOrder: number;
}

interface CurrentQuestion {
  id: string;
  prompt: string;
  type: string;
  options?: { id: string; text: string; isCorrect: boolean; order?: number }[];
  mediaUrl?: string;
  media?: QuestionMedia[];
  spotify?: {
    trackId: string;
    previewUrl: string | null;
    albumArt: string | null;
    trackName?: string | null;
    artistName?: string | null;
  };
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
  const [error, setError] = useState<string | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>("lobby");
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayerCount, setTotalPlayerCount] = useState(0); // Live count from server
  const [scoreboardData, setScoreboardData] = useState<{ type: string; players: Player[] }>({ type: "top10", players: [] });
  const [minigameType, setMinigameType] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  // ORDER question reveal data
  const [correctOrder, setCorrectOrder] = useState<Array<{ id: string; text: string; position: number }> | null>(null);
  const [correctText, setCorrectText] = useState<string | null>(null);
  // ESTIMATION reveal data
  const [correctNumber, setCorrectNumber] = useState<number | null>(null);
  const [estimationMargin, setEstimationMargin] = useState<number | null>(null);
  // Auto-transition state after locked
  const [waitingForHost, setWaitingForHost] = useState(false);
  // Speed Podium results
  const [speedPodiumResults, setSpeedPodiumResults] = useState<Array<{
    playerId: string;
    playerName: string;
    position: number;
    bonusPercentage: number;
    bonusPoints: number;
  }> | null>(null);

  // Use WebSocket without onMessage - we'll set up direct listeners
  const { socket, isConnected } = useWebSocket({
    sessionCode: code,
  });

  // Track if we've already joined the room
  const hasJoinedRoom = useRef(false);

  // Join session room when socket connects (ONE TIME ONLY)
  useEffect(() => {
    if (!socket || !isConnected || hasJoinedRoom.current) return;
    
    hasJoinedRoom.current = true;
    console.log("[Display] Socket connected, joining session room...");
    
    // Display joins the session room (as host-like viewer)
    socket.emit(WSMessageType.HOST_JOIN_SESSION, {
      sessionCode: code,
    });

    // Request current session state after joining (catch-up mechanism)
    setTimeout(() => {
      console.log("[Display] Requesting current session state...");
      socket.emit("GET_SESSION_STATE", { sessionCode: code });
    }, 500); // Wait 500ms for room join to complete
  }, [socket, isConnected, code]);

  // Set up event listeners SEPARATELY
  useEffect(() => {
    if (!socket) return;

    console.log("[Display] Setting up event listeners on socket:", socket.id);

    // Debug: log ALL incoming events
    const handleAny = (eventName: string, ...args: unknown[]) => {
      console.log("[Display] Received event:", eventName, args);
    };
    socket.onAny(handleAny);

    // Listen for session state
    const handleSessionState = (data: any) => {
      console.log("[Display] SESSION_STATE received:", data);
      if (data.players) {
        setSession(prev => prev ? { ...prev, players: data.players } : null);
      }
      
      // Check if Swan Chase is currently active
      if (data.currentActivity === "SWAN_CHASE" || data.activeMinigame === "SWAN_CHASE") {
        console.log("[Display] Session state indicates Swan Chase is active");
        setMinigameType("SWAN_CHASE");
        setDisplayState("minigame");
      }
      
      // Check if Swan Race is currently active
      if (data.currentActivity === "SWAN_RACE" || data.activeMinigame === "SWAN_RACE") {
        console.log("[Display] Session state indicates Swan Race is active");
        setMinigameType("SWAN_RACE");
        setDisplayState("minigame");
      }
    };

    // Listen for player joined - handle both nested and flat structure
    const handlePlayerJoined = (data: any) => {
      console.log("[Display] PLAYER_JOINED received:", data);
      // Support both { player: {...} } and flat { id, name, ... } format
      const playerData = data.player || data;
      if (playerData && (playerData.id || playerData.playerId)) {
        const newPlayer = {
          id: playerData.id || playerData.playerId,
          name: playerData.name,
          avatar: playerData.avatar || null,
          score: playerData.score || 0,
          isOnline: true,
        };
        setSession(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== newPlayer.id), newPlayer]
        } : null);
      }
    };

    // Listen for player left
    const handlePlayerLeft = (data: any) => {
      console.log("[Display] PLAYER_LEFT received:", data);
      if (data.playerId) {
        setSession(prev => prev ? {
          ...prev,
          players: prev.players.filter(p => p.id !== data.playerId)
        } : null);
      }
    };

    // Listen for item started
    const handleItemStarted = (data: any) => {
      console.log("[Display] ITEM_STARTED received:", data);
      
      // Extract Spotify data from media entries
      const spotifyMedia = data.media?.find((m: any) => m.provider === "SPOTIFY");
      const spotifyData = spotifyMedia ? {
        trackId: spotifyMedia.metadata?.trackId || "",
        previewUrl: spotifyMedia.url || null,
        albumArt: spotifyMedia.previewUrl || null, // previewUrl in media = albumArt for SPOTIFY
        trackName: spotifyMedia.metadata?.trackName || null,
        artistName: spotifyMedia.metadata?.artistName || null,
        startMs: spotifyMedia.metadata?.startMs ?? data.spotify?.startMs ?? 0,
        durationMs: spotifyMedia.metadata?.durationMs ?? data.spotify?.durationMs ?? 30000,
      } : data.spotify ? {
        trackId: data.spotify.trackId || "",
        previewUrl: data.spotify.previewUrl || null,
        albumArt: data.spotify.albumArt || null,
        trackName: data.spotify.trackName || null,
        artistName: data.spotify.artistName || null,
        startMs: data.spotify.startMs ?? 0,
        durationMs: data.spotify.durationMs ?? 30000,
      } : undefined;
      
      setCurrentQuestion({
        id: data.itemId,
        prompt: data.prompt,
        type: data.questionType,
        options: data.options?.map((opt: any) => ({
          ...opt,
          isCorrect: false, // Hide correct answer on display!
        })),
        mediaUrl: data.mediaUrl,
        media: data.media?.map((m: any, index: number) => ({
          id: m.id,
          url: m.url,
          type: m.mediaType,
          width: m.metadata?.width || null,
          height: m.metadata?.height || null,
          displayOrder: m.displayOrder ?? index,
        })),
        spotify: spotifyData,
      });
      setTimeRemaining(data.timerDuration);
      setAnsweredCount(0);
      setExplanation(null); // Reset explanation for new question
      setCorrectOrder(null); // Reset ORDER reveal data
      setCorrectText(null); // Reset open text reveal data
      setWaitingForHost(false); // Reset waiting state
      setSpeedPodiumResults(null); // Reset speed podium results
      setDisplayState("question");
    };

    // Listen for item locked
    const handleItemLocked = () => {
      console.log("[Display] ITEM_LOCKED");
      setDisplayState("locked");
    };

    // Listen for answer reveal
    const handleRevealAnswers = (data: any) => {
      console.log("[Display] REVEAL_ANSWERS:", data);
      
      // Handle different question types
      if (data.correctOrder) {
        // ORDER question: store correct order for display
        setCorrectOrder(data.correctOrder);
      } else if (data.correctOptionIds && data.correctOptionIds.length > 0) {
        // MC_MULTIPLE: mark all correct options
        setCurrentQuestion(prev => prev ? {
          ...prev,
          options: prev.options?.map(opt => ({
            ...opt,
            isCorrect: data.correctOptionIds.includes(opt.id),
          })),
        } : null);
      } else if (data.correctOptionId) {
        // MC_SINGLE/TRUE_FALSE: mark single correct option
        setCurrentQuestion(prev => prev ? {
          ...prev,
          options: prev.options?.map(opt => ({
            ...opt,
            isCorrect: opt.id === data.correctOptionId,
          })),
        } : null);
      } else if (data.correctText) {
        // Open text types: store correct text
        setCorrectText(data.correctText);
      }
      
      // ESTIMATION: store correct number and margin
      if (data.correctNumber !== undefined) {
        setCorrectNumber(data.correctNumber);
      }
      if (data.estimationMargin !== undefined) {
        setEstimationMargin(data.estimationMargin);
      }
      
      // Set explanation if provided
      setExplanation(data.explanation || null);
      setDisplayState("reveal");
    };

    // Listen for answer received (fallback)
    const handleAnswerReceived = () => {
      setAnsweredCount(prev => prev + 1);
    };

    // Listen for answer count updated (more reliable - from database)
    const handleAnswerCountUpdated = (data: { itemId: string; count: number; total: number }) => {
      console.log("[Display] ANSWER_COUNT_UPDATED:", data);
      setAnsweredCount(data.count);
      setTotalPlayerCount(data.total);
    };

    // Listen for leaderboard updates (real-time score changes)
    const handleLeaderboardUpdate = (data: any) => {
      console.log("[Display] LEADERBOARD_UPDATE:", data);
      if (data.leaderboard) {
        // Update session players with new scores from leaderboard
        setSession(prev => {
          if (!prev) return null;
          const updatedPlayers = prev.players.map(player => {
            const leaderboardEntry = data.leaderboard.find(
              (entry: any) => entry.playerId === player.id
            );
            if (leaderboardEntry) {
              return { ...player, score: leaderboardEntry.totalScore || 0 };
            }
            return player;
          });
          return { ...prev, players: updatedPlayers };
        });
      }
    };

    // Listen for scoreboard
    const handleShowScoreboard = (data: any) => {
      console.log("[Display] SHOW_SCOREBOARD:", data);
      // Use leaderboard data from the event (calculated fresh by WS server)
      const players = data.leaderboard?.map((entry: any) => ({
        id: entry.playerId,
        name: entry.playerName,
        avatar: entry.avatar || "👤",
        score: entry.totalScore || 0,
      })) || [];
      
      setScoreboardData({
        type: data.displayType || "top10",
        players: players,
      });
      setDisplayState("scoreboard");
    };

    const handleHideScoreboard = () => {
      console.log("[Display] HIDE_SCOREBOARD");
      // Return to lobby or previous state
      if (currentQuestion) {
        setDisplayState("question");
      } else {
        setDisplayState("lobby");
      }
    };

    // Listen for swan race
    const handleSwanRaceStarted = () => {
      console.log("[Display] SWAN_RACE_STARTED");
      setMinigameType("SWAN_RACE");
      setDisplayState("minigame");
    };

    // Listen for swan chase (new game mode)
    const handleSwanChaseStarted = () => {
      console.log("[Display] SWAN_CHASE_STARTED");
      setMinigameType("SWAN_CHASE");
      setDisplayState("minigame");
    };

    // Listen for session pause/resume/end
    const handleSessionPaused = () => {
      setDisplayState("paused");
    };

    const handleSessionResumed = () => {
      if (currentQuestion) {
        setDisplayState("question");
      } else {
        setDisplayState("lobby");
      }
    };

    const handleSessionEnded = (data: any) => {
      console.log("[Display] SESSION_ENDED:", data);
      // Store final scores from the event
      if (data.finalScores) {
        const players = data.finalScores.map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          avatar: entry.avatar || "👤",
          score: entry.score || 0,
        }));
        setScoreboardData({
          type: "final",
          players: players,
        });
      }
      setDisplayState("ended");
    };

    // Listen for item cancelled (host cancelled the current question)
    const handleItemCancelled = () => {
      console.log("[Display] ITEM_CANCELLED - returning to lobby");
      setCurrentQuestion(null);
      setTimeRemaining(null);
      setAnsweredCount(0);
      setExplanation(null);
      setCorrectOrder(null);
      setCorrectText(null);
      setSpeedPodiumResults(null);
      setDisplayState("lobby");
    };

    // Listen for Speed Podium results
    const handleSpeedPodiumResults = (data: any) => {
      console.log("[Display] SPEED_PODIUM_RESULTS:", data);
      if (data.results && Array.isArray(data.results)) {
        setSpeedPodiumResults(data.results);
      }
    };

    // Set up all listeners
    socket.on(WSMessageType.SESSION_STATE, handleSessionState);
    socket.on(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
    socket.on(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
    socket.on(WSMessageType.ITEM_STARTED, handleItemStarted);
    socket.on(WSMessageType.ITEM_LOCKED, handleItemLocked);
    socket.on(WSMessageType.REVEAL_ANSWERS, handleRevealAnswers);
    socket.on(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
    socket.on(WSMessageType.ANSWER_COUNT_UPDATED, handleAnswerCountUpdated);
    socket.on(WSMessageType.LEADERBOARD_UPDATE, handleLeaderboardUpdate);
    socket.on("SHOW_SCOREBOARD", handleShowScoreboard);
    socket.on("HIDE_SCOREBOARD", handleHideScoreboard);
    socket.on(WSMessageType.SWAN_RACE_STARTED, handleSwanRaceStarted);
    socket.on(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
    socket.on(WSMessageType.SESSION_PAUSED, handleSessionPaused);
    socket.on(WSMessageType.SESSION_RESUMED, handleSessionResumed);
    socket.on(WSMessageType.SESSION_ENDED, handleSessionEnded);
    socket.on(WSMessageType.ITEM_CANCELLED, handleItemCancelled);
    socket.on(WSMessageType.SPEED_PODIUM_RESULTS, handleSpeedPodiumResults);

    console.log("[Display] Event listeners registered successfully");

    // Cleanup listeners
    return () => {
      console.log("[Display] Cleaning up event listeners");
      socket.offAny(handleAny);
      socket.off(WSMessageType.SESSION_STATE, handleSessionState);
      socket.off(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
      socket.off(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
      socket.off(WSMessageType.ITEM_STARTED, handleItemStarted);
      socket.off(WSMessageType.ITEM_LOCKED, handleItemLocked);
      socket.off(WSMessageType.REVEAL_ANSWERS, handleRevealAnswers);
      socket.off(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
      socket.off(WSMessageType.ANSWER_COUNT_UPDATED, handleAnswerCountUpdated);
      socket.off(WSMessageType.LEADERBOARD_UPDATE, handleLeaderboardUpdate);
      socket.off("SHOW_SCOREBOARD", handleShowScoreboard);
      socket.off("HIDE_SCOREBOARD", handleHideScoreboard);
      socket.off(WSMessageType.SWAN_RACE_STARTED, handleSwanRaceStarted);
      socket.off(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
      socket.off(WSMessageType.SESSION_PAUSED, handleSessionPaused);
      socket.off(WSMessageType.SESSION_RESUMED, handleSessionResumed);
      socket.off(WSMessageType.SESSION_ENDED, handleSessionEnded);
      socket.off(WSMessageType.ITEM_CANCELLED, handleItemCancelled);
      socket.off(WSMessageType.SPEED_PODIUM_RESULTS, handleSpeedPodiumResults);
    };
  }, [socket, session, currentQuestion]);

  // Fetch session data
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions/code/${code}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Session not found");
          } else if (response.status === 410) {
            setError("This session has been archived and can no longer be displayed. The quiz was updated after this session was created.");
          } else {
            setError("Failed to load session");
          }
          return;
        }
        const data = await response.json();
        setSession(data.session);
      } catch (err) {
        console.error("Failed to fetch session:", err);
        setError("Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [code]);

  // Timer countdown - use ref-based approach for stable interval
  useEffect(() => {
    if (displayState !== "question") {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [displayState]); // Only depend on displayState, not timeRemaining

  // Auto-transition to "waiting for host" after locked state (3 seconds)
  // Cancel if reveal/scoreboard/ended happens
  useEffect(() => {
    if (displayState !== "locked") {
      setWaitingForHost(false);
      return;
    }

    const timeout = setTimeout(() => {
      setWaitingForHost(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [displayState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-white text-2xl font-bold mb-2">Session Unavailable</h1>
          <p className="text-slate-400">{error}</p>
        </div>
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
          <div className="w-full max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
              {/* Left side: QR Code */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-6 rounded-3xl shadow-2xl">
                  <QRCode 
                    value={joinUrl} 
                    size={280} 
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-lg text-slate-400 mt-4">Scan to join</p>
              </div>

              {/* Right side: Code + URL */}
              <div className="text-center">
                <p className="text-2xl text-slate-400 mb-4">Or join with code</p>
                <p 
                  className="text-8xl font-mono font-bold tracking-[0.3em]"
                  style={{ color: themeColor }}
                >
                  {code}
                </p>
                <p className="text-xl text-slate-500 mt-4">{joinUrl}</p>
              </div>
            </div>

            {/* Player Grid */}
            <div className="mt-16">
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
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
                <p className="text-xl text-slate-500 text-center">Waiting for players to join...</p>
              )}
            </div>
          </div>
        )}

        {/* QUESTION STATE */}
        {(displayState === "question" || displayState === "locked" || displayState === "reveal") && currentQuestion && (
          <div className="w-full max-w-6xl mx-auto">
            {/* Question Type Badge */}
            <div className="flex justify-center mb-4">
              <QuestionTypeBadge type={currentQuestion.type} size="lg" />
            </div>

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

            {/* Photo Grid for PHOTO_ question types */}
            {currentQuestion.type.startsWith('PHOTO_') && currentQuestion.media && currentQuestion.media.length > 0 && (
              <div className="mb-8">
                <PhotoGrid photos={currentQuestion.media} />
              </div>
            )}

            {/* Options - different display per question type */}
            
            {/* ORDER Question - show items that need to be ordered (without numbers/correct order) */}
            {currentQuestion.type === "ORDER" && displayState !== "reveal" && (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-2xl font-bold text-white mb-6">Put these items in the correct order:</p>
                {currentQuestion.options && currentQuestion.options.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
                    {currentQuestion.options.map((option) => (
                      <div
                        key={option.id}
                        className="px-6 py-4 bg-slate-700/80 rounded-xl text-xl font-semibold text-white"
                      >
                        {option.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* ORDER Question Reveal - show numbered list in correct order */}
            {displayState === "reveal" && correctOrder && correctOrder.length > 0 && (
              <div className="space-y-4">
                <p className="text-center text-white/60 text-lg mb-4">Correct order:</p>
                {correctOrder.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-6 rounded-2xl text-2xl font-bold bg-green-500/80 text-white flex items-center gap-4"
                  >
                    <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black">
                      {idx + 1}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Numeric Question - show input hint (NOT the answer!) */}
            {(currentQuestion.type === "NUMERIC" || currentQuestion.type === "SLIDER" || 
              currentQuestion.type === "PHOTO_NUMERIC" || currentQuestion.type === "PHOTO_SLIDER" ||
              currentQuestion.type === "ESTIMATION") && displayState !== "reveal" && (
              <div className="text-center py-8">
                <div className="text-6xl mb-6">🔢</div>
                <p className="text-2xl font-bold text-white mb-4">Enter your estimate!</p>
                <p className="text-lg text-white/60">Type a number on your phone</p>
              </div>
            )}
            
            {/* Text Input Questions - show input hint */}
            {(currentQuestion.type === "OPEN_TEXT" || 
              currentQuestion.type === "PHOTO_OPEN_TEXT" ||
              currentQuestion.type === "AUDIO_OPEN" ||
              currentQuestion.type === "VIDEO_OPEN") && displayState !== "reveal" && (
              <div className="text-center py-8">
                <div className="text-6xl mb-6">✍️</div>
                <p className="text-2xl font-bold text-white mb-4">Type your answer!</p>
                <p className="text-lg text-white/60">Enter your answer on your phone</p>
              </div>
            )}

            {/* MUSIC Questions - Spotify player + listening visual */}
            {(currentQuestion.type === "MUSIC_GUESS_TITLE" ||
              currentQuestion.type === "MUSIC_GUESS_ARTIST" ||
              currentQuestion.type === "MUSIC_GUESS_YEAR") && (
              <div className="py-6">
                {/* Spotify Player */}
                {currentQuestion.spotify?.previewUrl || currentQuestion.mediaUrl ? (
                  <div className="max-w-2xl mx-auto">
                    <SpotifyPlayer
                      trackId={currentQuestion.spotify?.trackId || ""}
                      previewUrl={currentQuestion.spotify?.previewUrl || currentQuestion.mediaUrl || ""}
                      albumArt={displayState === "reveal" ? (currentQuestion.spotify?.albumArt || undefined) : undefined}
                      title={displayState === "reveal" ? (currentQuestion.spotify?.trackName || undefined) : undefined}
                      artist={displayState === "reveal" ? (currentQuestion.spotify?.artistName || undefined) : undefined}
                      startMs={currentQuestion.spotify?.startMs}
                      durationMs={currentQuestion.spotify?.durationMs}
                      autoplay={displayState === "question"}
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎵</div>
                    <p className="text-xl text-white/60">Audio loading...</p>
                  </div>
                )}
                
                {/* Listening visual - during question phase */}
                {displayState === "question" && (
                  <div className="text-center mt-8">
                    {/* Blurred album art teaser */}
                    {currentQuestion.spotify?.albumArt && (
                      <div className="flex justify-center mb-6">
                        <div className="relative w-48 h-48">
                          <img
                            src={currentQuestion.spotify.albumArt}
                            alt="Mystery"
                            className="w-full h-full rounded-2xl shadow-2xl"
                            style={{ filter: "blur(30px) brightness(0.7)", transform: "scale(1.1)" }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-6xl">❓</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Animated equalizer bars */}
                    <div className="flex items-end justify-center gap-1.5 mb-4 h-16">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 bg-gradient-to-t from-green-500 to-green-300 rounded-full"
                          style={{
                            animation: `equalizer 0.8s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.07}s`,
                            height: "16px",
                          }}
                        />
                      ))}
                    </div>
                    <style jsx>{`
                      @keyframes equalizer {
                        0% { height: 8px; }
                        100% { height: ${40 + Math.random() * 24}px; }
                      }
                    `}</style>
                    
                    <p className="text-2xl font-bold text-white mb-2">
                      🎧 {currentQuestion.type === "MUSIC_GUESS_TITLE" ? "Guess the Song!" :
                          currentQuestion.type === "MUSIC_GUESS_ARTIST" ? "Guess the Artist!" :
                          "Guess the Year!"}
                    </p>
                    <p className="text-lg text-white/60">Listen carefully and answer on your phone</p>
                  </div>
                )}
                
                {/* Album art reveal with track info - animated unblur */}
                {displayState === "reveal" && currentQuestion.spotify?.albumArt && (
                  <div className="mt-6 flex flex-col items-center animate-in fade-in duration-700">
                    <div className="relative mb-4">
                      <img
                        src={currentQuestion.spotify.albumArt}
                        alt="Album Art"
                        className="w-56 h-56 rounded-2xl shadow-2xl transition-all duration-1000"
                        style={{ animation: "albumReveal 1s ease-out forwards" }}
                      />
                      <div className="absolute -inset-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-2xl opacity-30 blur-xl -z-10" />
                    </div>
                    <style jsx>{`
                      @keyframes albumReveal {
                        0% { filter: blur(20px) brightness(0.5); transform: scale(0.9); }
                        100% { filter: blur(0px) brightness(1); transform: scale(1); }
                      }
                    `}</style>
                    {currentQuestion.spotify.trackName && (
                      <p className="text-3xl font-black text-white mt-2">{currentQuestion.spotify.trackName}</p>
                    )}
                    {currentQuestion.spotify.artistName && (
                      <p className="text-xl text-white/70 mt-1">{currentQuestion.spotify.artistName}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* MUSIC GUESS YEAR Reveal - show correct year */}
            {displayState === "reveal" && correctNumber !== null && 
             currentQuestion.type === "MUSIC_GUESS_YEAR" && (
              <div className="text-center py-4">
                <div className="p-8 rounded-2xl bg-green-500/80 text-white inline-block">
                  <p className="text-2xl font-bold mb-2">Released in:</p>
                  <p className="text-6xl font-black">{correctNumber}</p>
                  {estimationMargin !== null && estimationMargin > 0 && (
                    <p className="text-xl text-white/80 mt-2">
                      ±{estimationMargin}% margin for full points
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Open Text Reveal - show correct text answer */}
            {displayState === "reveal" && correctText && (
              <div className="p-8 rounded-2xl bg-green-500/80 text-white text-center">
                <p className="text-4xl font-bold">{correctText}</p>
              </div>
            )}
            
            {/* Numeric Reveal - show correct number and margin */}
            {displayState === "reveal" && correctNumber !== null && 
             (currentQuestion.type === "NUMERIC" || currentQuestion.type === "SLIDER" || 
              currentQuestion.type === "PHOTO_NUMERIC" || currentQuestion.type === "PHOTO_SLIDER" ||
              currentQuestion.type === "ESTIMATION") && (
              <div className="text-center py-8">
                <div className="p-8 rounded-2xl bg-green-500/80 text-white">
                  <p className="text-2xl font-bold mb-2">Correct answer:</p>
                  <p className="text-6xl font-black mb-4">{correctNumber.toLocaleString("en-US")}</p>
                  {estimationMargin !== null && estimationMargin > 0 && (
                    <p className="text-xl text-white/80">
                      ±{estimationMargin}% margin for full points
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* MC/TRUE_FALSE Options - show grid with correct highlighted on reveal */}
            {/* Exclude ORDER, NUMERIC/SLIDER, OPEN_TEXT types since they have their own display */}
            {currentQuestion.options && 
             currentQuestion.type !== "ORDER" && 
             currentQuestion.type !== "MC_ORDER" &&
             currentQuestion.type !== "PHOTO_MC_ORDER" &&
             currentQuestion.type !== "NUMERIC" &&
             currentQuestion.type !== "SLIDER" &&
             currentQuestion.type !== "PHOTO_NUMERIC" &&
             currentQuestion.type !== "PHOTO_SLIDER" &&
             currentQuestion.type !== "ESTIMATION" &&
             currentQuestion.type !== "OPEN_TEXT" &&
             currentQuestion.type !== "PHOTO_OPEN_TEXT" &&
             currentQuestion.type !== "AUDIO_OPEN" &&
             currentQuestion.type !== "VIDEO_OPEN" &&
             currentQuestion.type !== "MUSIC_GUESS_TITLE" &&
             currentQuestion.type !== "MUSIC_GUESS_ARTIST" &&
             currentQuestion.type !== "MUSIC_GUESS_YEAR" &&
             !correctOrder && !correctText && (
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

            {/* Explanation - shown after reveal */}
            {displayState === "reveal" && explanation && (
              <div className="mt-8 p-6 bg-blue-900/50 border border-blue-500/30 rounded-2xl">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">💡</span>
                  <div>
                    <h3 className="text-xl font-bold text-blue-300 mb-2">Explanation</h3>
                    <p className="text-xl text-white leading-relaxed">{explanation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Speed Podium - shown after item locked/reveal */}
            {speedPodiumResults && speedPodiumResults.length > 0 && (displayState === "locked" || displayState === "reveal") && (
              <div className="mt-8 p-6 bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border border-yellow-500/30 rounded-2xl">
                <h3 className="text-2xl font-bold text-yellow-300 text-center mb-4">⚡ Speed Podium</h3>
                <div className="flex justify-center items-end gap-6">
                  {speedPodiumResults.map((result) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const heights = ["h-24", "h-20", "h-16"];
                    const bgColors = ["bg-yellow-500/40", "bg-slate-400/40", "bg-amber-700/40"];
                    
                    return (
                      <div key={result.playerId} className="text-center">
                        <div className="text-5xl mb-2">{medals[result.position - 1]}</div>
                        <p className="text-xl font-bold text-white mb-1">{result.playerName}</p>
                        <p className="text-lg text-green-400 font-semibold mb-2">+{result.bonusPoints} pts</p>
                        <div 
                          className={`${heights[result.position - 1]} w-24 rounded-t-lg ${bgColors[result.position - 1]} flex items-center justify-center`}
                        >
                          <span className="text-lg font-bold text-white/80">+{result.bonusPercentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Answer Progress */}
            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-4 bg-slate-800/80 backdrop-blur px-6 py-3 rounded-full">
                <span className="text-slate-400">Answered:</span>
                <span className="text-3xl font-bold">{answeredCount}</span>
                <span className="text-slate-400">/ {totalPlayerCount || session.players.length}</span>
              </div>
            </div>

            {/* Waiting for host - after auto-transition from locked */}
            {displayState === "locked" && waitingForHost && (
              <div className="mt-12 text-center animate-pulse">
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-2xl font-bold text-white/80">Waiting for host...</p>
              </div>
            )}
          </div>
        )}

        {/* SCOREBOARD STATE */}
        {displayState === "scoreboard" && (
          <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold text-center mb-12">🏆 Scoreboard</h2>
            
            {scoreboardData.players.length > 0 ? (
              <div className="space-y-4">
                {scoreboardData.players
                  .slice(0, scoreboardData.type === "top_3" ? 3 : scoreboardData.type === "top_5" ? 5 : 10)
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
            ) : (
              <div className="text-center">
                <p className="text-2xl text-slate-400">No scores yet</p>
              </div>
            )}
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

        {/* MINIGAME STATE - Swan Chase */}
        {displayState === "minigame" && minigameType === "SWAN_CHASE" && (
          <SwanChaseDisplay sessionCode={code} />
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
            
            {/* Top 3 Winners - use scoreboardData.players (from SESSION_ENDED event) */}
            {scoreboardData.players.length > 0 ? (
              <div className="flex justify-center items-end gap-8 mb-12">
                {scoreboardData.players
                  .slice(0, 3)
                  .map((player, index) => {
                    const heights = ["h-48", "h-40", "h-32"];
                    const positions = [1, 0, 2]; // 2nd, 1st, 3rd for podium order
                    const medals = ["🥇", "🥈", "🥉"];
                    const actualIndex = positions[index];
                    const actualPlayer = scoreboardData.players[actualIndex];
                    
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
            ) : (
              <div className="mb-12">
                <p className="text-2xl text-slate-400">No scores recorded</p>
              </div>
            )}

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
