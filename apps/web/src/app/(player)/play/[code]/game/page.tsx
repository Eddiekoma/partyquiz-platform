"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { QuestionType, WSMessageType } from "@partyquiz/shared";
import { QuestionDisplay } from "@/components/player/QuestionDisplay";
import { AnswerInput } from "@/components/player/AnswerInput";
import { Timer } from "@/components/player/Timer";
import { ScoreDisplay } from "@/components/player/ScoreDisplay";
import { SwanRace } from "@/components/SwanRace";

interface CurrentItem {
  id: string;
  questionType: QuestionType;
  prompt: string;
  mediaUrl?: string;
  options?: Array<{ id: string; text: string }>;
  timerDuration: number;
  settingsJson?: any;
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [myAnswer, setMyAnswer] = useState<any>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    score: number;
  } | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [showSwanRace, setShowSwanRace] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);

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
      setCurrentItem(null); // Hide current question
    });

    // Listen for item started (new question)
    socket.on("ITEM_STARTED", (data: any) => {
      console.log("[Player] Item started:", data);
      setShowSwanRace(false); // Hide Swan Race
      setCurrentItem({
        id: data.itemId,
        questionType: data.questionType,
        prompt: data.prompt,
        mediaUrl: data.mediaUrl,
        options: data.options,
        timerDuration: data.timerDuration,
        settingsJson: data.settingsJson,
      });
      setIsLocked(false);
      setTimeRemaining(data.timerDuration);
      setMyAnswer(null);
      setAnswerResult(null);
      setExplanation(null); // Reset explanation
      setShowReveal(false); // Reset reveal state
    });

    // Listen for item locked (time's up)
    socket.on("ITEM_LOCKED", () => {
      console.log("[Player] Item locked");
      setIsLocked(true);
    });

    // Listen for answer feedback
    socket.on("ANSWER_RECEIVED", (data: any) => {
      console.log("[Player] Answer received:", data);
      setAnswerResult({
        isCorrect: data.isCorrect,
        score: data.score,
      });
      if (data.isCorrect) {
        setCurrentScore((prev) => prev + data.score);
      }
    });

    // Listen for reveal answers (show correct answer)
    socket.on("REVEAL_ANSWERS", (data: any) => {
      console.log("[Player] Reveal answers:", data);
      // Show correct answer feedback and explanation if provided
      setExplanation(data.explanation || null);
      setShowReveal(true);
    });

    // Listen for session ended
    socket.on("SESSION_ENDED", () => {
      console.log("[Player] Session ended");
      router.push(`/play/${code}/results`);
    });

    // Listen for errors
    socket.on("ERROR", (data: any) => {
      console.error("[Player] Error:", data.message);
    });

    return () => {
      socket.off("SWAN_RACE_STARTED");
      socket.off("ITEM_STARTED");
      socket.off("ITEM_LOCKED");
      socket.off("ANSWER_RECEIVED");
      socket.off("REVEAL_ANSWERS");
      socket.off("SESSION_ENDED");
      socket.off("ERROR");
    };
  }, [socket, isConnected, code, router]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0 || isLocked) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [timeRemaining, isLocked]);

  const handleSubmitAnswer = (answer: any) => {
    if (!socket || !currentItem || isLocked || myAnswer !== null) return;

    console.log("[Player] Submitting answer:", answer);
    setMyAnswer(answer);

    socket.emit("SUBMIT_ANSWER", {
      sessionCode: code.toUpperCase(),
      itemId: currentItem.id,
      answer,
      submittedAtMs: Date.now(),
    });
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
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

  if (!currentItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <p className="text-xl font-bold text-white">Waiting for next question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 relative">
      {/* Timer */}
      <div className="absolute top-4 right-4 z-10">
        <Timer
          timeRemaining={timeRemaining}
          totalDuration={currentItem.timerDuration}
        />
      </div>

      {/* Score */}
      <div className="absolute top-4 left-4 z-10">
        <ScoreDisplay score={currentScore} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        <QuestionDisplay
          questionType={currentItem.questionType}
          prompt={currentItem.prompt}
          mediaUrl={currentItem.mediaUrl}
          settingsJson={currentItem.settingsJson}
        />

        {/* Answer Input */}
        {!isLocked && !myAnswer && (
          <div className="mt-8 w-full">
            <AnswerInput
              questionType={currentItem.questionType}
              options={currentItem.options}
              settingsJson={currentItem.settingsJson}
              onSubmit={handleSubmitAnswer}
              disabled={isLocked || myAnswer !== null}
            />
          </div>
        )}

        {/* Feedback */}
        {myAnswer && !answerResult && (
          <div className="mt-8 text-center">
            <div className="text-5xl mb-3 animate-pulse">📤</div>
            <p className="text-xl font-bold text-white">Answer submitted!</p>
            <p className="text-lg text-white/80">Waiting for results...</p>
          </div>
        )}

        {answerResult && (
          <div className="mt-8 text-center">
            <div className="text-7xl mb-4 animate-bounce">
              {answerResult.isCorrect ? "✅" : "❌"}
            </div>
            <p className="text-3xl font-black text-white mb-2">
              {answerResult.isCorrect ? "Correct!" : "Wrong!"}
            </p>
            {answerResult.isCorrect && (
              <p className="text-2xl font-bold text-yellow-300">
                +{answerResult.score} points
              </p>
            )}
          </div>
        )}

        {/* Explanation - shown after reveal */}
        {showReveal && explanation && (
          <div className="mt-6 p-4 bg-blue-900/60 border border-blue-500/40 rounded-xl mx-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-sm font-semibold text-blue-300 mb-1">Explanation</p>
                <p className="text-white">{explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
