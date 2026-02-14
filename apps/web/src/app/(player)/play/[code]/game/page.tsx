"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { QuestionType, WSMessageType, SwanChaseGameState } from "@partyquiz/shared";
import { QuestionDisplay } from "@/components/player/QuestionDisplay";
import { AnswerInput } from "@/components/player/AnswerInput";
import { Timer } from "@/components/player/Timer";
import { ScoreDisplay } from "@/components/player/ScoreDisplay";
import { SwanRace } from "@/components/SwanRace";
import { BoatControls } from "@/components/player/BoatControls";
import { SwanControls } from "@/components/player/SwanControls";
import { Leaderboard } from "@/components/player/Leaderboard";

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  totalScore: number;
}

interface CurrentItem {
  id: string;
  questionType: QuestionType;
  prompt: string;
  mediaUrl?: string;
  media?: Array<{ id: string; url: string; type: string; width?: number | null; height?: number | null; displayOrder: number }>;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  timerDuration: number;  // in milliseconds
  timerEndsAt?: number;   // absolute timestamp for sync
  settingsJson?: any;
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [myAnswer, setMyAnswer] = useState<any>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    score: number;
    scorePercentage?: number | null;
    maxScore?: number | null;
  } | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [showSwanRace, setShowSwanRace] = useState(false);
  const [showSwanChase, setShowSwanChase] = useState(false);
  const [swanChaseState, setSwanChaseState] = useState<SwanChaseGameState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scoreboardData, setScoreboardData] = useState<LeaderboardEntry[]>([]);
  // ORDER question reveal data
  const [correctOrder, setCorrectOrder] = useState<Array<{ id: string; text: string; position: number }> | null>(null);
  const [correctText, setCorrectText] = useState<string | null>(null);
  // ESTIMATION/NUMBER question reveal data
  const [correctNumber, setCorrectNumber] = useState<number | null>(null);
  const [estimationMargin, setEstimationMargin] = useState<number | null>(null);
  // Player's submitted answer for reveal display
  const [submittedAnswer, setSubmittedAnswer] = useState<any>(null);
  // Score percentage for feedback (0-100)
  const [scorePercentage, setScorePercentage] = useState<number | null>(null);
  // Acceptable answers for TEXT questions
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[] | null>(null);
  // Spotify track reveal data for MUSIC questions
  const [spotifyReveal, setSpotifyReveal] = useState<{
    trackName: string;
    artistName: string;
    albumName: string;
    albumArt: string | null;
    releaseYear: number | null;
  } | null>(null);
  // Auto-transition state after answer feedback
  const [waitingForNext, setWaitingForNext] = useState(false);
  // Speed podium results
  const [speedPodiumResult, setSpeedPodiumResult] = useState<{
    position: 1 | 2 | 3;
    bonusPoints: number;
    bonusPercentage: number;
  } | null>(null);
  // Score adjustment notification (host manually adjusted score)
  const [scoreAdjustment, setScoreAdjustment] = useState<{
    oldScore: number;
    newScore: number;
    newScorePercentage: number;
  } | null>(null);

  const { socket, isConnected } = useWebSocket();

  // Track if we've already rejoined the session
  const hasRejoinedRef = useRef(false);

  // Rejoin session when socket connects
  useEffect(() => {
    if (!socket || !isConnected) return;
    if (hasRejoinedRef.current) return;

    // Get player info from localStorage (use uppercase code for consistency)
    const storedPlayer = localStorage.getItem(`player-${code.toUpperCase()}`);
    if (storedPlayer) {
      const player = JSON.parse(storedPlayer);
      setPlayerId(player.id);
      setPlayerName(player.name);

      // Rejoin the session room
      console.log("[Player Game] Rejoining session with player:", player.id);
      hasRejoinedRef.current = true;
      socket.emit(WSMessageType.PLAYER_REJOIN, {
        sessionCode: code.toUpperCase(),
        playerId: player.id,
      });
    } else {
      // No stored player - redirect back to join
      console.log("[Player Game] No stored player found, redirecting to join");
      router.push(`/play/${code}`);
    }
  }, [socket, isConnected, code, router]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for Swan Race started
    socket.on("SWAN_RACE_STARTED", (data: any) => {
      console.log("[Player] Swan Race started:", data);
      setShowSwanRace(true);
      setShowSwanChase(false);
      setCurrentItem(null); // Hide current question
    });

    // Listen for Swan Chase started
    socket.on(WSMessageType.SWAN_CHASE_STARTED, (data: any) => {
      console.log("[Player] Swan Chase started:", data);
      setShowSwanChase(true);
      setShowSwanRace(false);
      setCurrentItem(null);
    });

    // Listen for Swan Chase state updates
    socket.on(WSMessageType.SWAN_CHASE_STATE, (state: SwanChaseGameState) => {
      setSwanChaseState(state);
    });

    // Listen for item started (new question)
    socket.on("ITEM_STARTED", (data: any) => {
      console.log("[Player] Item started:", data);
      setShowSwanRace(false); // Hide Swan Race
      setShowSwanChase(false); // Hide Swan Chase
      
      // timerDuration from server is in SECONDS, convert to MS for internal use
      const timerMs = (data.timerDuration || 4) * 1000;
      
      // Use timerEndsAt from server if available (better sync)
      // Otherwise calculate from timerDuration
      const serverTimerEndsAt = data.timerEndsAt || (Date.now() + timerMs);
      setTimerEndsAt(serverTimerEndsAt);
      
      // Calculate initial remaining time from server timestamp
      const initialRemaining = Math.max(0, serverTimerEndsAt - Date.now());
      
      setCurrentItem({
        id: data.itemId,
        questionType: data.questionType,
        prompt: data.prompt,
        mediaUrl: data.mediaUrl,
        media: data.media?.map((m: any, index: number) => ({
          id: m.id,
          url: m.url,
          type: m.mediaType,
          width: m.metadata?.width || null,
          height: m.metadata?.height || null,
          displayOrder: m.displayOrder ?? index,
        })),
        options: data.options,
        timerDuration: timerMs, // Store in milliseconds
        timerEndsAt: serverTimerEndsAt,
        settingsJson: data.settingsJson,
      });
      setIsLocked(false);
      setTimeRemaining(initialRemaining); // Use server-synced time
      setMyAnswer(null);
      setAnswerResult(null);
      setExplanation(null); // Reset explanation
      setShowReveal(false); // Reset reveal state
      setCorrectOrder(null); // Reset ORDER reveal data
      setCorrectText(null); // Reset open text reveal data
      setCorrectNumber(null); // Reset ESTIMATION reveal data
      setEstimationMargin(null);
      setSubmittedAnswer(null); // Reset submitted answer
      setScorePercentage(null); // Reset score percentage
      setAcceptableAnswers(null); // Reset acceptable answers
      setSpotifyReveal(null); // Reset spotify reveal data
      setWaitingForNext(false); // Reset waiting state
      setSpeedPodiumResult(null); // Reset speed podium result
      setScoreAdjustment(null); // Reset score adjustment notification
    });

    // Listen for item locked (time's up)
    socket.on("ITEM_LOCKED", () => {
      console.log("[Player] Item locked");
      setIsLocked(true);
      setTimerEndsAt(null); // Stop timer
    });

    // Listen for session paused - freeze timer
    socket.on("SESSION_PAUSED", (data: any) => {
      console.log("[Player] Session paused:", data);
      // Store remaining time, clear timerEndsAt to stop countdown
      setTimerEndsAt(null);
    });

    // Listen for session resumed - restart timer
    socket.on("SESSION_RESUMED", (data: any) => {
      console.log("[Player] Session resumed:", data);
      // Server sends new timerEndsAt
      if (data.timerEndsAt) {
        setTimerEndsAt(data.timerEndsAt);
      }
    });

    // Listen for answer feedback
    socket.on("ANSWER_RECEIVED", (data: any) => {
      console.log("[Player] Answer received:", data);
      
      // If player already answered (on rejoin), lock and show their previous result
      if (data.alreadyAnswered) {
        console.log("[Player] Already answered this question - locking input");
        setIsLocked(true);
        setMyAnswer({ alreadyAnswered: true }); // Mark as already answered
      }
      
      setAnswerResult({
        isCorrect: data.isCorrect,
        score: data.score,
        scorePercentage: data.scorePercentage ?? null,
        maxScore: data.maxScore ?? null,
      });
      // Store score percentage for display
      if (data.scorePercentage !== undefined) {
        setScorePercentage(data.scorePercentage);
      }
      // Add score if player earned points (including partial scores for ORDER, ESTIMATION etc.)
      if (data.score > 0 && !data.alreadyAnswered) {
        setCurrentScore((prev) => prev + data.score);
      }
    });

    // Listen for reveal answers (show correct answer)
    socket.on("REVEAL_ANSWERS", (data: any) => {
      console.log("[Player] Reveal answers:", data);
      
      // Update currentItem with question context from server.
      // This is critical for re-reveal: when host navigates back to a previous
      // question, the player's currentItem still holds the last active question.
      // The server sends questionContext with the correct prompt/options for the
      // question being revealed.
      if (data.questionContext) {
        setCurrentItem(prev => ({
          id: data.itemId,
          questionType: data.questionType || prev?.questionType || "",
          prompt: data.questionContext.prompt,
          options: data.questionContext.options || [],
          settingsJson: data.questionContext.settingsJson || prev?.settingsJson || {},
          // Preserve timer/media fields from previous state (not relevant for reveal)
          mediaUrl: prev?.mediaUrl,
          media: prev?.media,
          timerDuration: prev?.timerDuration || 0,
          timerEndsAt: prev?.timerEndsAt,
        }));
      }

      // Find this player's submitted answer from the answers array
      if (data.answers && playerId) {
        const myAnswerData = data.answers.find((a: any) => a.playerId === playerId);
        if (myAnswerData) {
          setSubmittedAnswer(myAnswerData.answer);
          // Calculate score percentage if we have points info
          const qContext = data.questionContext;
          const basePoints = qContext?.settingsJson?.points || currentItem?.settingsJson?.points || 10;
          if (myAnswerData.points !== undefined) {
            // Estimate percentage from score (without bonuses)
            const pct = Math.min(100, Math.round((myAnswerData.points / basePoints) * 100));
            setScorePercentage(pct);
          }
        }
      }
      
      // Handle different question types
      if (data.correctOrder) {
        // ORDER question: store correct order for display
        setCorrectOrder(data.correctOrder);
      } else if (data.correctNumber !== undefined && data.correctNumber !== null) {
        // NUMERIC/SLIDER/ESTIMATION/MUSIC_GUESS_YEAR: store correct number and margin
        setCorrectNumber(data.correctNumber);
        setEstimationMargin(data.estimationMargin || null);
      } else if (data.correctOptionIds && data.correctOptionIds.length > 0) {
        // MC_MULTIPLE: mark all correct options on the (now-correct) currentItem
        setCurrentItem(prev => prev ? {
          ...prev,
          options: prev.options?.map(opt => ({
            ...opt,
            isCorrect: data.correctOptionIds.includes(opt.id),
          })),
        } : null);
      } else if (data.correctOptionId) {
        // MC_SINGLE/TRUE_FALSE: mark single correct option
        setCurrentItem(prev => prev ? {
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
      
      // Store acceptable answers for TEXT questions
      if (data.acceptableAnswers) {
        setAcceptableAnswers(data.acceptableAnswers);
      }

      // Store Spotify track info for MUSIC question reveal
      if (data.spotify) {
        setSpotifyReveal({
          trackName: data.spotify.trackName || "",
          artistName: data.spotify.artistName || "",
          albumName: data.spotify.albumName || "",
          albumArt: data.spotify.albumArt || null,
          releaseYear: data.spotify.releaseYear || null,
        });
      }
      
      // Show correct answer feedback and explanation if provided
      setExplanation(data.explanation || null);
      setShowReveal(true);
    });

    // Listen for session ended
    socket.on("SESSION_ENDED", (data: any) => {
      console.log("[Player] Session ended:", data);
      // If leaderboard data is included, cache it for the results page
      if (data.leaderboard) {
        sessionStorage.setItem(`finalLeaderboard-${code.toUpperCase()}`, JSON.stringify(data.leaderboard));
      }
      router.push(`/play/${code}/results`);
    });

    // Listen for scoreboard show/hide
    socket.on("SHOW_SCOREBOARD", (data: any) => {
      console.log("[Player] Show scoreboard:", data);
      if (data.leaderboard) {
        setScoreboardData(data.leaderboard);
      }
      setShowScoreboard(true);
    });

    socket.on("HIDE_SCOREBOARD", () => {
      console.log("[Player] Hide scoreboard");
      setShowScoreboard(false);
    });

    // Listen for leaderboard updates (to keep data fresh)
    socket.on("LEADERBOARD_UPDATE", (data: any) => {
      if (data.leaderboard) {
        setScoreboardData(data.leaderboard);
      }
    });

    // Listen for being kicked by host
    socket.on(WSMessageType.PLAYER_KICKED, (data: any) => {
      console.log("[Player] Kicked from session:", data);
      // Clear player data from localStorage
      localStorage.removeItem(`player-${code.toUpperCase()}`);
      // Show message and redirect
      alert(data.reason || "You have been removed from the session by the host.");
      router.push("/join");
    });

    // Listen for item cancelled (host cancelled the current question)
    socket.on(WSMessageType.ITEM_CANCELLED, () => {
      console.log("[Player] Item cancelled by host");
      setCurrentItem(null);
      setIsLocked(false);
      setTimerEndsAt(null);
      setTimeRemaining(0);
      setMyAnswer(null);
      setAnswerResult(null);
      setExplanation(null);
      setShowReveal(false);
      setCorrectOrder(null);
      setCorrectText(null);
      setCorrectNumber(null);
      setEstimationMargin(null);
      setSubmittedAnswer(null);
      setScorePercentage(null);
      setAcceptableAnswers(null);
    });

    // Listen for errors - handle gracefully
    socket.on("ERROR", (data: any) => {
      // "Time's up" is expected game flow, not an error
      if (data.message?.includes("Time's up") || data.code === "ITEM_LOCKED") {
        console.log("[Player] Question closed:", data.message);
        setIsLocked(true);
        return;
      }
      // Log other errors
      console.warn("[Player] Server message:", data.message);
    });

    // Listen for speed podium results
    socket.on(WSMessageType.SPEED_PODIUM_RESULTS, (data: any) => {
      console.log("[Player] Speed podium results:", data);
      // Check if this player is on the podium
      const myPodiumResult = data.podium?.find((p: any) => p.playerId === playerId);
      if (myPodiumResult) {
        setSpeedPodiumResult({
          position: myPodiumResult.position,
          bonusPoints: myPodiumResult.bonusPoints,
          bonusPercentage: myPodiumResult.bonusPercentage,
        });
        // Update score with bonus
        setCurrentScore((prev) => prev + myPodiumResult.bonusPoints);
      }
    });

    // Listen for score adjustment (host manually adjusted OPEN_TEXT score)
    socket.on(WSMessageType.SCORE_ADJUSTED, (data: any) => {
      console.log("[Player] Score adjusted:", data);
      // Only show notification if this player's score was adjusted
      if (data.playerId === playerId) {
        const oldScore = data.previousScore ?? data.oldScore ?? 0;
        const newScore = data.newScore ?? 0;
        const scoreDiff = newScore - oldScore;
        // Update current score with the difference
        setCurrentScore((prev) => prev + scoreDiff);
        // Show notification
        setScoreAdjustment({
          oldScore: oldScore,
          newScore: newScore,
          newScorePercentage: data.newScorePercentage ?? 0,
        });
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setScoreAdjustment(null);
        }, 5000);
      }
    });

    return () => {
      socket.off("SWAN_RACE_STARTED");
      socket.off(WSMessageType.SWAN_CHASE_STARTED);
      socket.off(WSMessageType.SWAN_CHASE_STATE);
      socket.off("ITEM_STARTED");
      socket.off("ITEM_LOCKED");
      socket.off("SESSION_PAUSED");
      socket.off("SESSION_RESUMED");
      socket.off("ANSWER_RECEIVED");
      socket.off("REVEAL_ANSWERS");
      socket.off("SESSION_ENDED");
      socket.off("SHOW_SCOREBOARD");
      socket.off("HIDE_SCOREBOARD");
      socket.off("LEADERBOARD_UPDATE");
      socket.off(WSMessageType.PLAYER_KICKED);
      socket.off(WSMessageType.ITEM_CANCELLED);
      socket.off("ERROR");
      socket.off(WSMessageType.SPEED_PODIUM_RESULTS);
      socket.off(WSMessageType.SCORE_ADJUSTED);
    };
  }, [socket, isConnected, code, router, playerId]);

  // Timer countdown - syncs with server timerEndsAt timestamp
  useEffect(() => {
    if (isLocked || !timerEndsAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, timerEndsAt - Date.now());
      setTimeRemaining(remaining);
      
      // Auto-lock when timer reaches 0
      if (remaining === 0) {
        setIsLocked(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timerEndsAt, isLocked]);

  // Auto-transition to "waiting for next" after answer feedback (3 seconds)
  // Cancel if reveal/scoreboard/session end happens
  useEffect(() => {
    if (!answerResult) {
      setWaitingForNext(false);
      return;
    }
    
    // If reveal or scoreboard is shown, don't auto-transition
    if (showReveal || showScoreboard) {
      setWaitingForNext(false);
      return;
    }

    const timeout = setTimeout(() => {
      setWaitingForNext(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [answerResult, showReveal, showScoreboard]);

  const handleSubmitAnswer = (answer: any) => {
    if (!socket || !currentItem || isLocked) return;

    console.log("[Player] Submitting answer:", answer, myAnswer !== null ? "(overwrite)" : "(new)");
    
    // If overwriting, subtract old score first (server handles DB, we handle local display)
    if (myAnswer !== null && answerResult?.score) {
      setCurrentScore((prev) => Math.max(0, prev - answerResult.score));
    }
    
    setMyAnswer(answer);
    setAnswerResult(null); // Reset result for new answer
    setWaitingForNext(false);

    socket.emit("SUBMIT_ANSWER", {
      sessionCode: code.toUpperCase(),
      itemId: currentItem.id,
      answer,
      submittedAtMs: Date.now(),
    });
  };

  // Swan Chase handlers
  const handleSwanChaseMove = (angle: number, speed: number) => {
    if (!socket || !showSwanChase) return;

    socket.emit(WSMessageType.BOAT_MOVE, {
      sessionCode: code.toUpperCase(),
      playerId,
      angle,
      speed,
    });
  };

  const handleSwanChaseSprint = () => {
    if (!socket || !showSwanChase) return;

    socket.emit(WSMessageType.BOAT_SPRINT, {
      sessionCode: code.toUpperCase(),
      playerId,
    });
  };

  const handleSwanChaseSwanMove = (angle: number, speed: number) => {
    if (!socket || !showSwanChase) return;

    socket.emit(WSMessageType.SWAN_MOVE, {
      sessionCode: code.toUpperCase(),
      playerId,
      angle,
      speed,
    });
  };

  const handleSwanChaseDash = () => {
    if (!socket || !showSwanChase) return;

    socket.emit(WSMessageType.SWAN_DASH, {
      sessionCode: code.toUpperCase(),
      playerId,
    });
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Leaderboard
          sessionCode={code.toUpperCase()}
          visible={showScoreboard}
          entries={scoreboardData}
          currentPlayerId={playerId}
        />
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔌</div>
          <p className="text-xl font-bold text-white">Reconnecting...</p>
        </div>
      </div>
    );
  }

  // Show Swan Race if active
  if (showSwanRace) {
    return (
      <div className="flex-1 flex flex-col p-4">
        <Leaderboard
          sessionCode={code.toUpperCase()}
          visible={showScoreboard}
          entries={scoreboardData}
          currentPlayerId={playerId}
        />
        <SwanRace
          sessionCode={code.toUpperCase()}
          playerId={playerId}
          playerName={playerName}
          isActive={true}
          onFinish={(position) => {
            console.log(`[Player] Finished Swan Race in position ${position}`);
            // Keep showing race for celebration
          }}
        />
      </div>
    );
  }

  // Show Swan Chase if active
  if (showSwanChase) {
    const myPlayer = swanChaseState?.players.find((p) => p.id === playerId);
    const isBoat = myPlayer?.type === "BOAT";

    if (isBoat) {
      return (
        <div className="flex-1 flex flex-col">
          <Leaderboard
            sessionCode={code.toUpperCase()}
            visible={showScoreboard}
            entries={scoreboardData}
            currentPlayerId={playerId}
          />
          <BoatControls
            sessionCode={code.toUpperCase()}
            playerId={playerId}
            gameState={swanChaseState}
            onMove={handleSwanChaseMove}
            onSprint={handleSwanChaseSprint}
            socket={socket}
          />
        </div>
      );
    } else {
      // Swan controls
      return (
        <div className="flex-1 flex flex-col">
          <Leaderboard
            sessionCode={code.toUpperCase()}
            visible={showScoreboard}
            entries={scoreboardData}
            currentPlayerId={playerId}
          />
          <SwanControls
            sessionCode={code.toUpperCase()}
            playerId={playerId}
            gameState={swanChaseState}
            onMove={handleSwanChaseSwanMove}
            onDash={handleSwanChaseDash}
            socket={socket}
          />
        </div>
      );
    }
  }

  if (!currentItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Leaderboard
          sessionCode={code.toUpperCase()}
          visible={showScoreboard}
          entries={scoreboardData}
          currentPlayerId={playerId}
        />
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <p className="text-xl font-bold text-white">Waiting for next question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 md:p-4">
      {/* Score Adjustment Notification */}
      {scoreAdjustment && (
        <div className="fixed inset-x-0 top-16 flex justify-center z-50 pointer-events-none animate-in slide-in-from-top duration-300 px-4">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl flex items-center gap-3 border-2 border-white/20">
            <div className="text-3xl md:text-4xl">
              {scoreAdjustment.newScore > scoreAdjustment.oldScore ? "📈" : 
               scoreAdjustment.newScore < scoreAdjustment.oldScore ? "📉" : "✏️"}
            </div>
            <div>
              <p className="text-xs md:text-sm font-medium text-white/80">Score adjusted by host</p>
              <p className="text-lg md:text-xl font-bold">
                {scoreAdjustment.oldScore} → {scoreAdjustment.newScore} points
                <span className="ml-2 text-base md:text-lg">
                  ({scoreAdjustment.newScore > scoreAdjustment.oldScore ? "+" : ""}
                  {scoreAdjustment.newScore - scoreAdjustment.oldScore})
                </span>
              </p>
              <p className="text-xs md:text-sm text-white/60">{scoreAdjustment.newScorePercentage}% awarded</p>
            </div>
          </div>
        </div>
      )}

      {/* Scoreboard Overlay */}
      <Leaderboard
        sessionCode={code.toUpperCase()}
        visible={showScoreboard}
        entries={scoreboardData}
        currentPlayerId={playerId}
      />

      {/* Top Bar: Score + Timer (flow layout, not absolute) */}
      <div className="flex items-center justify-between mb-3 md:mb-4 flex-shrink-0">
        <ScoreDisplay score={currentScore} />
        <Timer
          timeRemaining={timeRemaining}
          totalDuration={currentItem.timerDuration}
        />
      </div>

      {/* Feedback ABOVE question — score result, time's up, waiting */}
      {/* Time's Up - no answer submitted */}
      {isLocked && !myAnswer && !answerResult && (
        <div className="text-center mb-4 flex-shrink-0">
          <div className="text-5xl md:text-7xl mb-2 md:mb-4">⏰</div>
          <p className="text-2xl md:text-3xl font-black text-red-400 mb-1">Time&apos;s Up!</p>
          <p className="text-lg md:text-xl text-white/70">No answer submitted</p>
          <p className="text-base md:text-lg text-red-300 mt-1">0 points</p>
        </div>
      )}

      {/* Feedback - answer submitted, waiting for result */}
      {myAnswer && !answerResult && (
        <div className="text-center mb-4 flex-shrink-0">
          <div className="text-4xl md:text-5xl mb-2 animate-pulse">📤</div>
          <p className="text-lg md:text-xl font-bold text-white">Answer submitted!</p>
          <p className="text-base md:text-lg text-white/80">Waiting for results...</p>
        </div>
      )}

      {/* Answer Result feedback */}
      {answerResult && !waitingForNext && (
        <div className="text-center mb-4 flex-shrink-0">
          {/* Icon based on score percentage */}
          <div className="text-5xl md:text-7xl mb-2 md:mb-4 animate-bounce">
            {answerResult.scorePercentage === 100 
              ? "✅" 
              : answerResult.scorePercentage !== undefined && answerResult.scorePercentage !== null && answerResult.scorePercentage >= 90
                ? "🌟"
                : answerResult.score > 0 
                  ? "⭐" 
                  : "❌"}
          </div>
          <p className="text-2xl md:text-3xl font-black text-white mb-1 md:mb-2">
            {/* Graduated feedback based on percentage */}
            {answerResult.scorePercentage === 100 
              ? "Perfect!" 
              : answerResult.scorePercentage !== undefined && answerResult.scorePercentage !== null && answerResult.scorePercentage >= 90
                ? "Almost perfect!"
                : answerResult.scorePercentage !== undefined && answerResult.scorePercentage !== null && answerResult.scorePercentage >= 70
                  ? "Close enough!"
                  : answerResult.scorePercentage !== undefined && answerResult.scorePercentage !== null && answerResult.scorePercentage >= 50
                    ? "Partially correct!"
                    : answerResult.score > 0
                      ? "Points earned!"
                      : "Too bad!"}
          </p>
          {/* Show percentage for non-perfect scores */}
          {answerResult.score > 0 && answerResult.scorePercentage !== undefined && answerResult.scorePercentage !== null && answerResult.scorePercentage < 100 && (
            <p className="text-base md:text-lg text-white/70 mb-1">{answerResult.scorePercentage}% correct</p>
          )}
          {answerResult.score > 0 && (
            <p className="text-xl md:text-2xl font-bold text-yellow-300">
              +{answerResult.score} points
            </p>
          )}
          {/* Speed Podium bonus */}
          {speedPodiumResult && (
            <div className="mt-3 animate-pulse">
              <div className="text-4xl md:text-5xl mb-1">
                {speedPodiumResult.position === 1 ? "🥇" : speedPodiumResult.position === 2 ? "🥈" : "🥉"}
              </div>
              <p className="text-lg md:text-xl font-bold text-purple-300">
                Speed Bonus: +{speedPodiumResult.bonusPoints}!
              </p>
              <p className="text-xs md:text-sm text-white/60">
                {speedPodiumResult.position === 1 ? "Fastest correct answer!" : 
                 speedPodiumResult.position === 2 ? "2nd fastest!" : "3rd fastest!"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Waiting for next question - after auto-transition */}
      {answerResult && waitingForNext && !showReveal && !showScoreboard && (
        <div className="text-center mb-4 flex-shrink-0">
          <div className="text-4xl md:text-5xl mb-2 md:mb-4 animate-pulse">⏳</div>
          <p className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">
            {answerResult.isCorrect 
              ? "Well done!" 
              : answerResult.score > 0 
                ? scorePercentage !== null && scorePercentage >= 70 
                  ? "Almost!" 
                  : "Points earned!" 
                : "Better luck next time!"}
          </p>
          <p className="text-base md:text-lg text-white/60">Waiting for next question...</p>
          <p className="text-xs md:text-sm text-white/40 mt-1">Score: {currentScore} points</p>
        </div>
      )}

      {/* Question + Answer area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full min-w-0 overflow-y-auto">
        <QuestionDisplay
          questionType={currentItem.questionType}
          prompt={currentItem.prompt}
          mediaUrl={currentItem.mediaUrl}
          media={currentItem.media}
          settingsJson={currentItem.settingsJson}
        />

        {/* Answer Input - show if not locked (allow changing answer before lock) */}
        {!isLocked && (
          <div className="mt-4 md:mt-8 w-full">
            <AnswerInput
              questionType={currentItem.questionType}
              options={currentItem.options}
              settingsJson={currentItem.settingsJson}
              onSubmit={handleSubmitAnswer}
              disabled={isLocked}
            />
            {/* Show inline submit confirmation right below input */}
            {myAnswer !== null && !answerResult && (
              <div className="mt-3 p-3 md:p-4 rounded-xl bg-green-600/30 border border-green-500/50 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-base md:text-lg font-bold text-green-300">
                  ✅ Antwoord verzonden!
                </p>
                <p className="text-sm text-green-200/70 mt-1">
                  ✏️ Je kunt je antwoord wijzigen tot de tijd om is
                </p>
              </div>
            )}
            {myAnswer !== null && answerResult && (
              <div className={`mt-3 p-3 md:p-4 rounded-xl text-center animate-in fade-in duration-300 ${
                answerResult.score > 0 
                  ? "bg-green-600/30 border border-green-500/50" 
                  : "bg-red-600/30 border border-red-500/50"
              }`}>
                <p className="text-lg md:text-xl font-bold text-white">
                  {answerResult.scorePercentage === 100 
                    ? "🎯 Perfect!" 
                    : answerResult.score > 0 
                      ? `⭐ ${answerResult.score} punten!` 
                      : "❌ Helaas, geen punten"}
                </p>
                <p className="text-sm text-white/60 mt-1">
                  ✏️ Je kunt je antwoord nog wijzigen
                </p>
              </div>
            )}
          </div>
        )}

        {/* Correct Answer Reveal - different display per question type */}
        {showReveal && (
          <div className="mt-4 md:mt-8 w-full">

            {/* 🎵 Spotify Track Reveal for MUSIC questions */}
            {spotifyReveal && (
              <div className="mb-4 md:mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-br from-green-900/60 to-slate-900/80 border border-green-500/30 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4">
                  {spotifyReveal.albumArt && (
                    <img
                      src={spotifyReveal.albumArt}
                      alt={spotifyReveal.albumName}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl shadow-lg shadow-green-500/20 flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-1">🎵 Now Playing</p>
                    <p className="text-lg md:text-xl font-bold text-white truncate">{spotifyReveal.trackName}</p>
                    <p className="text-sm md:text-base text-white/70 truncate">{spotifyReveal.artistName}</p>
                    <p className="text-xs text-white/50 mt-1 truncate">
                      {spotifyReveal.albumName}
                      {spotifyReveal.releaseYear && ` • ${spotifyReveal.releaseYear}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-center text-white/60 text-xs md:text-sm mb-3 md:mb-4 font-semibold uppercase tracking-wide">Correct Answer</p>
            
            {/* ORDER Question Reveal - show numbered list in correct order */}
            {correctOrder && correctOrder.length > 0 && (
              <div className="space-y-2">
                {correctOrder.map((item, idx) => {
                  // Check if player had this item in the correct position
                  const playerAnswer = Array.isArray(myAnswer) ? myAnswer : [];
                  const isCorrectPosition = playerAnswer[idx] === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 md:p-4 rounded-xl text-sm md:text-base font-bold transition-all flex items-center gap-3 ${
                        isCorrectPosition
                          ? "bg-green-500/80 text-white ring-2 ring-green-300"
                          : "bg-slate-700/60 text-white"
                      }`}
                    >
                      <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center text-base md:text-lg font-black flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 break-words">{item.text}</span>
                      {isCorrectPosition && <span className="ml-auto flex-shrink-0">✅</span>}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Open Text Reveal - show correct text answer AND player's answer */}
            {correctText && (
              <div className="space-y-3 md:space-y-4">
                {/* Player's submitted answer */}
                {submittedAnswer && (
                  <div className="p-3 md:p-4 rounded-xl bg-slate-700/60 text-white">
                    <p className="text-xs md:text-sm text-white/60 mb-1">Your answer:</p>
                    <p className="text-base md:text-lg font-bold">{String(submittedAnswer)}</p>
                  </div>
                )}
                {/* Correct answer */}
                <div className="p-4 md:p-6 rounded-xl bg-green-500/80 text-white text-center">
                  <p className="text-xs md:text-sm text-white/80 mb-1">Correct answer:</p>
                  <p className="text-lg md:text-xl font-bold">{correctText}</p>
                </div>
                {/* Acceptable alternatives if any */}
                {acceptableAnswers && acceptableAnswers.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-800/60 text-white/60 text-xs md:text-sm">
                    <p className="mb-1">Also accepted: {acceptableAnswers.join(", ")}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* NUMERIC/SLIDER/ESTIMATION Reveal - show correct number, player's answer, and difference */}
            {correctNumber !== null && (
              <div className="space-y-3 md:space-y-4">
                {/* Player's submitted answer with comparison */}
                {submittedAnswer !== null && submittedAnswer !== undefined && (
                  <div className={`p-3 md:p-4 rounded-xl ${
                    answerResult?.score && answerResult.score > 0 
                      ? "bg-green-600/40 border border-green-500/50" 
                      : "bg-red-600/40 border border-red-500/50"
                  }`}>
                    <p className="text-xs md:text-sm text-white/60 mb-1">Your answer:</p>
                    <p className="text-xl md:text-2xl font-bold text-white">
                      {typeof submittedAnswer === "number" 
                        ? submittedAnswer.toLocaleString("en-US") 
                        : String(submittedAnswer)}
                    </p>
                    {/* Show difference */}
                    {typeof submittedAnswer === "number" && (
                      <p className="text-xs md:text-sm text-white/70 mt-1">
                        {submittedAnswer === correctNumber 
                          ? "🎯 Exactly right!" 
                          : submittedAnswer > correctNumber 
                            ? `↑ ${(submittedAnswer - correctNumber).toLocaleString("en-US")} too high`
                            : `↓ ${(correctNumber - submittedAnswer).toLocaleString("en-US")} too low`
                        }
                      </p>
                    )}
                  </div>
                )}
                {/* Correct answer */}
                <div className="p-4 md:p-6 rounded-xl bg-green-500/80 text-white text-center">
                  <p className="text-xs md:text-sm text-white/80 mb-1">Correct answer:</p>
                  <p className="text-2xl md:text-3xl font-bold">{correctNumber.toLocaleString("en-US")}</p>
                  {estimationMargin && (
                    <p className="text-xs md:text-sm text-white/70 mt-2">
                      Margin for full points: ±{estimationMargin}%
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* MC/TRUE_FALSE Reveal - show options with correct one highlighted */}
            {!correctOrder && !correctText && correctNumber === null && currentItem?.options && currentItem.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                {currentItem.options.map((option, idx) => {
                  // Check if player selected this option
                  // For MC_MULTIPLE: myAnswer is array of IDs
                  // For MC_SINGLE/TRUE_FALSE: myAnswer is single ID
                  const playerSelected = Array.isArray(myAnswer) 
                    ? myAnswer.includes(option.id)
                    : myAnswer === option.id;
                  
                  // Determine styling based on correct/selected state
                  let styling = "";
                  let icon = "";
                  
                  if (option.isCorrect && playerSelected) {
                    // Correct answer AND player selected it = GREEN with thick ring and scale
                    styling = "bg-green-500 text-white ring-4 ring-green-300 scale-[1.02] shadow-lg shadow-green-500/50";
                    icon = "✓";
                  } else if (option.isCorrect && !playerSelected) {
                    // Correct answer but player DIDN'T select it = GREEN dimmed
                    styling = "bg-green-500 text-white opacity-60";
                    icon = "✓";
                  } else if (!option.isCorrect && playerSelected) {
                    // Wrong answer AND player selected it = RED with ring and scale
                    styling = "bg-red-600 text-white ring-4 ring-red-300 scale-[1.02]";
                    icon = "✗";
                  } else {
                    // Wrong answer and NOT selected = RED dimmed
                    styling = "bg-red-600 text-white opacity-40";
                    icon = "✗";
                  }
                  
                  return (
                    <div
                      key={option.id}
                      className={`p-3 md:p-4 rounded-xl text-sm md:text-base font-bold transition-all ${styling}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="opacity-70 text-xs md:text-sm flex-shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {icon && <span className="flex-shrink-0">{icon}</span>}
                          <span className="min-w-0 break-words">{option.text}</span>
                        </div>
                        {playerSelected && (
                          <span className="text-xs bg-white/20 px-2 py-1 rounded font-semibold flex-shrink-0 ml-2">YOU</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Explanation - shown after reveal */}
        {showReveal && explanation && (
          <div className="mt-4 md:mt-6 p-3 md:p-4 bg-blue-900/60 border border-blue-500/40 rounded-xl">
            <div className="flex items-start gap-2 md:gap-3">
              <span className="text-xl md:text-2xl flex-shrink-0">💡</span>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-semibold text-blue-300 mb-1">Explanation</p>
                <p className="text-sm md:text-base text-white">{explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
