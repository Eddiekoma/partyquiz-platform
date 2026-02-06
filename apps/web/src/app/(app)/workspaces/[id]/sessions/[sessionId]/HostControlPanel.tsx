"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessage, WSMessageType } from "@partyquiz/shared";
import { YouTubePlayer, YouTubePlayerControls } from "@/components/YouTubePlayer";
import { extractYouTubeVideoId } from "@partyquiz/shared";
import { PlayerConnectionStatus } from "@/components/live/PlayerConnectionStatus";

interface HostControlPanelProps {
  session: any;
  quiz: any;
}

export default function HostControlPanel({ session, quiz }: HostControlPanelProps) {
  const router = useRouter();
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isItemActive, setIsItemActive] = useState(false);
  const [isItemLocked, setIsItemLocked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const youtubePlayerRef = useRef<HTMLDivElement>(null);

  // Flatten all items for easy navigation
  const allItems = quiz.rounds.flatMap((round: any) =>
    round.items.map((item: any) => ({
      ...item,
      roundTitle: round.title,
      roundId: round.id,
    }))
  );

  const currentItem = allItems[currentItemIndex] || null;
  const totalItems = allItems.length;

  // WebSocket connection
  const { socket, isConnected, error: wsError, send } = useWebSocket({
    sessionCode: session.code,
    onMessage: (message: WSMessage) => {
      console.log("Host received WS message:", message);

      switch (message.type) {
        case WSMessageType.ITEM_STARTED:
          setIsItemActive(true);
          setIsItemLocked(false);
          setTimeRemaining(message.payload?.timeLimit || null);
          break;

        case WSMessageType.ITEM_LOCKED:
          setIsItemLocked(true);
          break;

        case WSMessageType.REVEAL:
          // Answers revealed
          router.refresh();
          break;

        case WSMessageType.SESSION_ENDED:
          router.refresh();
          break;

        case WSMessageType.ANSWER_COUNT_UPDATED:
          router.refresh();
          break;

        case WSMessageType.SESSION_PAUSED:
          setIsPaused(true);
          break;

        case WSMessageType.SESSION_RESUMED:
          setIsPaused(false);
          break;

        default:
          break;
      }
    },
  });

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || !isItemActive || isItemLocked) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isItemActive, isItemLocked]);

  // WebSocket actions
  function startItem() {
    if (!currentItem) return;

    const message: WSMessage = {
      type: WSMessageType.START_ITEM,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
        itemId: currentItem.id,
        timeLimit: currentItem.timeLimit,
      },
    };

    send(message);
    setError(null);
  }

  function lockItem() {
    if (!currentItem) return;

    const message: WSMessage = {
      type: WSMessageType.LOCK_ITEM,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
        itemId: currentItem.id,
      },
    };

    send(message);
    setError(null);
  }

  function revealAnswers() {
    if (!currentItem) return;

    const message: WSMessage = {
      type: WSMessageType.REVEAL_ANSWERS,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
        itemId: currentItem.id,
      },
    };

    send(message);
    setError(null);
  }

  function endSession() {
    const message: WSMessage = {
      type: WSMessageType.END_SESSION,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
      },
    };

    send(message);
    setError(null);
  }

  function pauseSession() {
    const message: WSMessage = {
      type: WSMessageType.PAUSE_SESSION,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
      },
    };

    send(message);
    setError(null);
  }

  function resumeSession() {
    const message: WSMessage = {
      type: WSMessageType.RESUME_SESSION,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
      },
    };

    send(message);
    setError(null);
  }

  function startSwanRace() {
    const message: WSMessage = {
      type: WSMessageType.START_SWAN_RACE,
      timestamp: Date.now(),
      payload: {
        sessionCode: session.code,
      },
    };

    send(message);
    setError(null);
  }

  // Navigation
  function goToNextItem() {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setIsItemActive(false);
      setIsItemLocked(false);
      setTimeRemaining(null);
    }
  }

  function goToPreviousItem() {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
      setIsItemActive(false);
      setIsItemLocked(false);
      setTimeRemaining(null);
    }
  }

  if (session.status === "ENDED") {
    return (
      <div className="bg-white border border-slate-700 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Session Ended</h3>
        <p className="text-slate-400 text-sm">This session has ended. View the final results above.</p>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="bg-white border border-slate-700 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-2">No Questions</h3>
        <p className="text-slate-400 text-sm">This quiz has no questions to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Player Connection Status */}
      <PlayerConnectionStatus socket={socket} sessionCode={session.code} />

      {/* WebSocket Status */}
      <div className="bg-white border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm font-medium">{isConnected ? "✅ Connected" : "❌ Disconnected"}</span>
        </div>
        {wsError && <p className="text-xs text-red-600 mt-2">Error: {wsError.message}</p>}
      </div>

      {/* Current Question */}
      <div className="bg-white border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-slate-400">Round: {currentItem.roundTitle}</p>
            <h3 className="font-semibold text-gray-900">
              Question {currentItemIndex + 1} of {totalItems}
            </h3>
          </div>
          {timeRemaining !== null && (
            <div className="text-right">
              <p className="text-sm text-slate-400">Time Remaining</p>
              <p className={`text-2xl font-bold ${timeRemaining <= 10 ? "text-red-600" : "text-gray-900"}`}>
                {timeRemaining}s
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
          <p className="text-gray-900 font-medium">{currentItem.question.prompt}</p>
          <p className="text-sm text-slate-400 mt-2">Type: {currentItem.question.type}</p>
          <p className="text-sm text-slate-400">Points: {currentItem.points}</p>
          <p className="text-sm text-slate-400">Time Limit: {currentItem.timeLimit}s</p>
        </div>

        {/* YouTube Preview & Controls (for YouTube questions) */}
        {currentItem.question.media?.[0]?.url && (
          currentItem.question.type === "YOUTUBE_SCENE_QUESTION" ||
          currentItem.question.type === "YOUTUBE_NEXT_LINE" ||
          currentItem.question.type === "YOUTUBE_WHO_SAID_IT"
        ) && (() => {
          const videoId = extractYouTubeVideoId(currentItem.question.media[0].url);
          if (!videoId) return null;

          const settingsJson = currentItem.question.settingsJson || {};
          const startSeconds = settingsJson.startSeconds || 0;
          const endSeconds = settingsJson.endSeconds;

          return (
            <div className="mb-4 border border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-700 px-4 py-2 border-b border-slate-700">
                <p className="text-sm font-medium text-slate-300">🎬 YouTube Preview (Host Only)</p>
              </div>
              <div className="p-4 bg-white">
                <div ref={youtubePlayerRef}>
                  <YouTubePlayer
                    videoId={videoId}
                    autoplay={false}
                    startSeconds={startSeconds}
                    endSeconds={endSeconds}
                    onReady={() => console.log("[Host] YouTube player ready")}
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (youtubePlayerRef.current) {
                        YouTubePlayerControls.play(youtubePlayerRef.current);
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                  >
                    ▶️ Play
                  </button>
                  <button
                    onClick={() => {
                      if (youtubePlayerRef.current) {
                        YouTubePlayerControls.pause(youtubePlayerRef.current);
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
                  >
                    ⏸️ Pause
                  </button>
                  <button
                    onClick={() => {
                      if (youtubePlayerRef.current) {
                        YouTubePlayerControls.seekTo(youtubePlayerRef.current, startSeconds);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    ⏮️ Reset to Start
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Question Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={goToPreviousItem}
            disabled={currentItemIndex === 0}
            className="px-4 py-2 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 disabled:bg-slate-800/50 disabled:text-slate-500 transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={goToNextItem}
            disabled={currentItemIndex === totalItems - 1}
            className="px-4 py-2 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 disabled:bg-slate-800/50 disabled:text-slate-500 transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Control Buttons */}
        <div className="space-y-2">
          {/* Pause/Resume Button */}
          {!isPaused ? (
            <button
              onClick={pauseSession}
              disabled={!isConnected}
              className="w-full px-4 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-300 transition-colors"
            >
              ⏸️ Pause Session
            </button>
          ) : (
            <button
              onClick={resumeSession}
              disabled={!isConnected}
              className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
            >
              ▶️ Resume Session
            </button>
          )}

          {!isItemActive && (
            <button
              onClick={startItem}
              disabled={!isConnected || isPaused}
              className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
            >
              ▶️ Start Question
            </button>
          )}

          {isItemActive && !isItemLocked && (
            <button
              onClick={lockItem}
              disabled={!isConnected || isPaused}
              className="w-full px-4 py-3 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 transition-colors"
            >
              🔒 Lock Answers
            </button>
          )}

          {isItemLocked && (
            <button
              onClick={revealAnswers}
              disabled={!isConnected || isPaused}
              className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              👁️ Reveal Answers
            </button>
          )}

          <button
            onClick={startSwanRace}
            disabled={!isConnected || isPaused}
            className="w-full px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
          >
            🦢 Start Swan Race
          </button>

          <button
            onClick={endSession}
            disabled={!isConnected}
            className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-colors"
          >
            ⏹️ End Session
          </button>
        </div>

        {isPaused && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">⏸️ Session is paused. Players cannot submit answers.</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
