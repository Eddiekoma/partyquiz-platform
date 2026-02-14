"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessageType, type Player as SharedPlayer, type ConnectionStatus, QuestionType, type SwanChaseGameState, requiresPhotos } from "@partyquiz/shared";
import Link from "next/link";
import { QuestionTypeBadge, getQuestionTypeIcon } from "@/components/QuestionTypeBadge";
import { AnswerPanel, type PlayerAnswer } from "@/components/host/AnswerPanel";
import { PhotoGrid } from "@/components/PhotoGrid";
import QRCode from "react-qr-code";
import { SwanChaseConfig } from "@/components/host/SwanChaseConfig";

interface Player {
  id: string;
  name: string;
  avatar?: string | null;
  score: number;
  isOnline?: boolean;
  connectionQuality?: "good" | "poor" | "offline";
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
    options?: { id: string; text: string; isCorrect: boolean; order?: number }[];
    media?: Array<{
      id: string;
      provider: string;
      mediaType: string;
      reference: any;
      displayOrder: number;
      order: number;
    }>;
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
  const [totalPlayerCount, setTotalPlayerCount] = useState(0); // Live count from server
  const [isPaused, setIsPaused] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<Map<string, { isOnline: boolean; quality: string }>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  // Track which items have been completed (answers revealed)
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  // Scoreboard controls
  const [showingScoreboard, setShowingScoreboard] = useState(false);
  const [scoreboardType, setScoreboardType] = useState<"TOP_3" | "TOP_5" | "TOP_10" | "ALL">("TOP_10");
  // Rejoin token state
  const [rejoinTokens, setRejoinTokens] = useState<Map<string, string>>(new Map());
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  // Left players who have answers (can rejoin)
  const [leftPlayers, setLeftPlayers] = useState<Array<{
    id: string;
    name: string;
    avatar?: string | null;
    score: number;
    leftAt: number;
  }>>([]);
  // Answer panel state
  const [currentItemAnswers, setCurrentItemAnswers] = useState<Array<{
    itemId: string;
    playerId: string;
    playerName: string;
    playerAvatar?: string | null;
    questionType: string;
    answerDisplay: string;
    rawAnswer: any;
    isCorrect: boolean | null;
    score: number;
    maxScore?: number;
    answeredAt: number;
    selectedOptionIds?: string[];
    submittedOrder?: string[];
    // OPEN_TEXT score adjustment fields
    answerId?: string;
    autoScore?: number;
    autoScorePercentage?: number;
    isManuallyAdjusted?: boolean;
  }>>([]);
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);
  // History of all answers per item (preserved across questions)
  const [answerHistory, setAnswerHistory] = useState<Map<string, Array<{
    itemId: string;
    playerId: string;
    playerName: string;
    playerAvatar?: string | null;
    questionType: string;
    answerDisplay: string;
    rawAnswer: any;
    isCorrect: boolean | null;
    score: number;
    maxScore?: number;
    answeredAt: number;
    selectedOptionIds?: string[];
    submittedOrder?: string[];
    // OPEN_TEXT score adjustment fields
    answerId?: string;
    autoScore?: number;
    autoScorePercentage?: number;
    isManuallyAdjusted?: boolean;
  }>>>(new Map());
  // Show question history sidebar
  const [showQuestionHistory, setShowQuestionHistory] = useState(false);
  // Selected historical question to view
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState<string | null>(null);
  // Answer counts per item (restored from server after page refresh)
  const [answerCountsMap, setAnswerCountsMap] = useState<Record<string, number>>({});
  // Swan Chase state
  const [showSwanChaseConfig, setShowSwanChaseConfig] = useState(false);
  const [swanChaseState, setSwanChaseState] = useState<SwanChaseGameState | null>(null);

  // Refs to access current values in event handlers
  const currentItemAnswersRef = useRef(currentItemAnswers);
  const allItemsRef = useRef<Array<{ id: string; questionType?: string }>>([]);
  const currentItemIndexRef = useRef(currentItemIndex);

  // Keep refs in sync with state
  useEffect(() => {
    currentItemAnswersRef.current = currentItemAnswers;
  }, [currentItemAnswers]);

  useEffect(() => {
    currentItemIndexRef.current = currentItemIndex;
  }, [currentItemIndex]);

  // Use WebSocket without onMessage - we'll set up direct listeners
  const { socket, isConnected, send } = useWebSocket({
    sessionCode: code,
  });

  // Join session room when socket connects (ONE TIME ONLY)
  useEffect(() => {
    if (!socket || !isConnected || hasJoinedRoom) return;

    console.log("[Host] Socket connected, socket id:", socket.id);
    console.log("[Host] Joining session room for code:", code);
    
    // Host joins the session room
    socket.emit(WSMessageType.HOST_JOIN_SESSION, {
      sessionCode: code,
    });
    
    // Mark as joined to prevent re-joining
    setHasJoinedRoom(true);
  }, [socket, isConnected, code, hasJoinedRoom]);

  // Set up event listeners SEPARATELY (runs when socket changes)
  useEffect(() => {
    if (!socket) return;

    console.log("[Host] Setting up event listeners on socket:", socket.id);
    
    // Debug: log ALL incoming events
    const handleAny = (eventName: string, ...args: unknown[]) => {
      console.log("[Host] Received event:", eventName, args);
    };
    socket.onAny(handleAny);

    // Listen for session state (sent after joining)
    const handleSessionState = (data: any) => {
      console.log("[Host] SESSION_STATE received:", data);
      if (data.players) {
        setSession(prev => prev ? { ...prev, players: data.players } : null);
      }
      // Restore completed items from server (after page refresh)
      if (data.completedItemIds && Array.isArray(data.completedItemIds)) {
        console.log("[Host] Restoring completedItemIds:", data.completedItemIds);
        setCompletedItemIds(new Set(data.completedItemIds));
      }
      // Restore answer counts per item (after page refresh)
      if (data.answerCounts) {
        console.log("[Host] Restoring answerCounts:", data.answerCounts);
        setAnswerCountsMap(data.answerCounts);
      }
      // Restore answer history from server (after page refresh)
      if (data.answerHistory) {
        console.log("[Host] Restoring answerHistory:", Object.keys(data.answerHistory).length, "items");
        const restoredHistory = new Map<string, typeof currentItemAnswers>();
        for (const [itemId, answers] of Object.entries(data.answerHistory)) {
          restoredHistory.set(itemId, answers as typeof currentItemAnswers);
        }
        setAnswerHistory(restoredHistory);
      }
      // Restore left players with answers (after page refresh)
      if (data.leftPlayersWithAnswers && Array.isArray(data.leftPlayersWithAnswers)) {
        console.log("[Host] Restoring leftPlayersWithAnswers:", data.leftPlayersWithAnswers.length);
        setLeftPlayers(data.leftPlayersWithAnswers);
      }
    };

    // Listen for player joined - handle both nested and flat structure
    const handlePlayerJoined = (data: any) => {
      console.log("[Host] PLAYER_JOINED received:", data);
      // Support both { player: {...} } and flat { id, name, ... } format
      const playerData = data.player || data;
      if (playerData && (playerData.id || playerData.playerId)) {
        const playerId = playerData.id || playerData.playerId;
        const newPlayer: Player = {
          id: playerId,
          name: playerData.name,
          avatar: playerData.avatar || null,
          score: playerData.score || 0,
          isOnline: true,
        };
        setSession(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== newPlayer.id), newPlayer]
        } : null);
        // Remove from leftPlayers if they rejoined
        setLeftPlayers(prev => prev.filter(p => p.id !== playerId));
      }
    };

    // Listen for player left
    const handlePlayerLeft = (data: any) => {
      console.log("[Host] PLAYER_LEFT received:", data);
      if (data.playerId) {
        // If player has answers, move to leftPlayers instead of removing completely
        if (data.hasAnswers) {
          // Get the player data before removing from session
          setSession(prev => {
            if (!prev) return null;
            const leavingPlayer = prev.players.find(p => p.id === data.playerId);
            // Add to leftPlayers with the data from the event or session
            const leftPlayer = {
              id: data.playerId,
              name: data.name || leavingPlayer?.name || 'Unknown',
              avatar: data.avatar || leavingPlayer?.avatar || null,
              score: data.score ?? leavingPlayer?.score ?? 0,
              leftAt: Date.now(),
            };
            // Schedule the leftPlayers update
            setTimeout(() => {
              setLeftPlayers(current => {
                // Avoid duplicates
                if (current.some(p => p.id === leftPlayer.id)) return current;
                return [...current, leftPlayer];
              });
            }, 0);
            // Remove from active players
            return {
              ...prev,
              players: prev.players.filter(p => p.id !== data.playerId)
            };
          });
        } else {
          // No answers - just remove completely
          setSession(prev => prev ? {
            ...prev,
            players: prev.players.filter(p => p.id !== data.playerId)
          } : null);
        }
        // Also remove from live status
        setLiveConnectionStatus(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.playerId);
          return newMap;
        });
      }
    };

    // Listen for connection status updates (presence)
    const handleConnectionStatus = (data: { connections: ConnectionStatus[] }) => {
      console.log("[Host] CONNECTION_STATUS_UPDATE received:", data);
      if (data.connections) {
        // Update the live connection status map
        setLiveConnectionStatus(prev => {
          const newMap = new Map(prev);
          data.connections.forEach(conn => {
            newMap.set(conn.playerId, {
              isOnline: conn.isOnline,
              quality: conn.connectionQuality || 'unknown',
            });
          });
          return newMap;
        });
        
        // Also update session players for backward compatibility
        setSession(prev => {
          if (!prev) return null;
          const updatedPlayers = prev.players.map(player => {
            const connection = data.connections.find(c => c.playerId === player.id);
            if (connection) {
              return {
                ...player,
                isOnline: connection.isOnline,
                connectionQuality: connection.connectionQuality,
              };
            }
            return player;
          });
          return { ...prev, players: updatedPlayers };
        });
      }
    };

    // Listen for answer received (sent to player, but we also use it as fallback)
    const handleAnswerReceived = (data: any) => {
      console.log("[Host] ANSWER_RECEIVED:", data);
      // Fallback increment - ANSWER_COUNT_UPDATED is more reliable
      setAnsweredCount(prev => prev + 1);
    };

    // Listen for answer count updated (more reliable - includes database count)
    const handleAnswerCountUpdated = (data: { itemId: string; count: number; total: number }) => {
      console.log("[Host] ANSWER_COUNT_UPDATED:", data);
      setAnsweredCount(data.count);
      setTotalPlayerCount(data.total);
    };

    // Listen for detailed player answer (for answer panel)
    const handlePlayerAnswered = (data: {
      itemId: string;
      playerId: string;
      playerName: string;
      playerAvatar?: string | null;
      questionType: string;
      answerDisplay: string;
      rawAnswer: any;
      isCorrect: boolean | null;
      score: number;
      maxScore?: number;
      timeSpentMs?: number;
      answeredAt: number;
      selectedOptionIds?: string[];
      submittedOrder?: string[];
      // For OPEN_TEXT: auto scoring info
      answerId?: string;
      autoScore?: number;
      autoScorePercentage?: number;
      isManuallyAdjusted?: boolean;
    }) => {
      console.log("[Host] PLAYER_ANSWERED:", data);
      setCurrentItemAnswers(prev => {
        // If player already answered this item, update with new answer (overwrite)
        const existingIdx = prev.findIndex(a => a.playerId === data.playerId && a.itemId === data.itemId);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = data;
          return updated;
        }
        return [...prev, data];
      });
      
      // Player who answered is definitely online - update connection status
      setLiveConnectionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.playerId, {
          isOnline: true,
          quality: 'good',
        });
        return newMap;
      });
    };

    // Listen for item locked (auto-lock when timer expires or all answered)
    const handleItemLocked = (data: { itemId: string }) => {
      console.log("[Host] ITEM_LOCKED (auto-lock):", data);
      setItemState("locked");
      setTimeRemaining(0); // Stop the countdown display
      
      // Mark item as completed automatically when locked
      if (data.itemId) {
        setCompletedItemIds(prev => new Set([...prev, data.itemId]));
        
        // Save current answers to history
        const currentAnswers = currentItemAnswersRef.current;
        if (currentAnswers.length > 0) {
          setAnswerHistory(prev => {
            const updated = new Map(prev);
            updated.set(data.itemId, [...currentAnswers]);
            return updated;
          });
        }
        console.log("[Host] Item marked as completed:", data.itemId);
      }
    };

    // Listen for item cancelled
    const handleItemCancelled = (data: any) => {
      console.log("[Host] ITEM_CANCELLED:", data);
      setItemState("idle");
      setTimeRemaining(0);
      setAnsweredCount(0);
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
      setTimeRemaining(0);
      setCompletedItemIds(new Set()); // Clear completed items
      // Update session status
      setSession(prev => prev ? { 
        ...prev, 
        status: "LOBBY",
        players: data.players || prev.players 
      } : null);
    };

    // Listen for errors (both custom ERROR event and socket.io native "error" event)
    const handleError = (data: any) => {
      console.error("[Host] WS Error:", JSON.stringify(data, null, 2));
    };
    
    // Socket.IO native error event (lowercase) - can be empty object on connection issues
    const handleNativeError = (error: any) => {
      console.error("[Host] Socket.IO native error:", error?.message || error || "(no error details)");
    };

    // Listen for rejoin token generated
    const handleRejoinTokenGenerated = (data: any) => {
      console.log("[Host] REJOIN_TOKEN_GENERATED:", data);
      if (data.playerId && data.token) {
        setRejoinTokens(prev => new Map(prev).set(data.playerId, data.token));
        setGeneratingToken(null);
        
        // Build the rejoin URL and copy to clipboard
        const rejoinUrl = `${window.location.origin}/play/${code}/rejoin?token=${data.token}`;
        navigator.clipboard.writeText(rejoinUrl).then(() => {
          alert(`Rejoin link for ${data.playerName} copied to clipboard!\n\n${rejoinUrl}`);
        }).catch(() => {
          // If clipboard fails, show the link in alert
          alert(`Rejoin link for ${data.playerName}:\n\n${rejoinUrl}`);
        });
      }
    };

    // Listen for leaderboard updates (player scores)
    const handleLeaderboardUpdate = (data: { leaderboard: Array<{ playerId: string; playerName: string; avatar: string; totalScore: number }> }) => {
      console.log("[Host] LEADERBOARD_UPDATE received:", data);
      if (data.leaderboard) {
        setSession(prev => {
          if (!prev) return null;
          const updatedPlayers = prev.players.map(player => {
            const leaderboardEntry = data.leaderboard.find(l => l.playerId === player.id);
            if (leaderboardEntry) {
              return {
                ...player,
                score: leaderboardEntry.totalScore,
              };
            }
            return player;
          });
          return { ...prev, players: updatedPlayers };
        });
      }
    };

    // Listen for score adjusted (host adjusted OPEN_TEXT score)
    const handleScoreAdjusted = (data: {
      itemId: string;
      playerId: string;
      previousScore: number;
      newScore: number;
      newScorePercentage: number;
      adjustedBy: string;
    }) => {
      console.log("[Host] SCORE_ADJUSTED received:", data);
      // Update the answer in currentItemAnswers
      setCurrentItemAnswers(prev => prev.map(answer => {
        if (answer.playerId === data.playerId && answer.itemId === data.itemId) {
          return {
            ...answer,
            score: data.newScore,
            isCorrect: data.newScore > 0,
            isManuallyAdjusted: true,
          };
        }
        return answer;
      }));
      // Also update in answer history
      setAnswerHistory(prev => {
        const updated = new Map(prev);
        const itemAnswers = updated.get(data.itemId);
        if (itemAnswers) {
          updated.set(data.itemId, itemAnswers.map(answer => {
            if (answer.playerId === data.playerId) {
              return {
                ...answer,
                score: data.newScore,
                isCorrect: data.newScore > 0,
                isManuallyAdjusted: true,
              };
            }
            return answer;
          }));
        }
        return updated;
      });
    };

    // Listen for reveal answers (includes all players, even those who didn't answer)
    const handleRevealAnswers = (data: {
      itemId: string;
      questionType: string;
      answers: Array<{
        playerId: string;
        playerName: string;
        playerAvatar?: string;
        answer: any;
        answerDisplay?: string;
        isCorrect: boolean | null;
        points: number;
        timeSpentMs?: number;
        selectedOptionIds?: string[];
        submittedOrder?: string[];
      }>;
      noAnswerPlayers?: Array<{
        playerId: string;
        playerName: string;
        playerAvatar?: string;
      }>;
    }) => {
      console.log("[Host] REVEAL_ANSWERS received:", data);
      
      const now = Date.now();
      
      // Merge answered players and no-answer players
      const allPlayerAnswers: PlayerAnswer[] = [
        // Answered players (with actual answers, using server-formatted display)
        ...data.answers.map(a => ({
          playerId: a.playerId,
          playerName: a.playerName,
          playerAvatar: a.playerAvatar,
          itemId: data.itemId,
          questionType: data.questionType,
          answer: a.answer,
          answerDisplay: a.answerDisplay || (typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer)),
          rawAnswer: a.answer,
          score: a.points,
          isCorrect: a.isCorrect,
          answeredAt: now,
          noAnswer: false,
          timeSpentMs: a.timeSpentMs,
          selectedOptionIds: a.selectedOptionIds,
          submittedOrder: a.submittedOrder,
        })),
        // Non-answered players (with special status)
        ...(data.noAnswerPlayers || []).map(p => ({
          playerId: p.playerId,
          playerName: p.playerName,
          playerAvatar: p.playerAvatar,
          itemId: data.itemId,
          questionType: data.questionType,
          answer: null,
          answerDisplay: "Geen antwoord ingediend",
          rawAnswer: null,
          score: 0,
          isCorrect: null,
          answeredAt: now,
          noAnswer: true,
        })),
      ];
      
      // Update current item answers
      setCurrentItemAnswers(allPlayerAnswers);
      
      console.log("[Host] Updated currentItemAnswers with all players:", {
        answeredCount: data.answers.length,
        noAnswerCount: data.noAnswerPlayers?.length || 0,
        totalCount: allPlayerAnswers.length,
      });
    };

    // Swan Chase handlers
    const handleSwanChaseStarted = (data: SwanChaseGameState) => {
      console.log("[Host] Swan Chase started:", data);
      setSwanChaseState(data);
      setShowSwanChaseConfig(true);
    };

    const handleSwanChaseState = (data: SwanChaseGameState) => {
      setSwanChaseState(data);
    };

    const handleSwanChaseEnded = (data: SwanChaseGameState) => {
      console.log("[Host] Swan Chase ended:", data);
      setSwanChaseState(data);
    };

    // Set up all listeners
    socket.on(WSMessageType.SESSION_STATE, handleSessionState);
    socket.on(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
    socket.on(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
    socket.on("CONNECTION_STATUS_UPDATE", handleConnectionStatus);
    socket.on(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
    socket.on(WSMessageType.ANSWER_COUNT_UPDATED, handleAnswerCountUpdated);
    socket.on(WSMessageType.PLAYER_ANSWERED, handlePlayerAnswered);
    socket.on(WSMessageType.ITEM_LOCKED, handleItemLocked);
    socket.on(WSMessageType.ITEM_CANCELLED, handleItemCancelled);
    socket.on(WSMessageType.SESSION_ENDED, handleSessionEnded);
    socket.on(WSMessageType.SESSION_RESET, handleSessionReset);
    socket.on(WSMessageType.ERROR, handleError);
    socket.on("error", handleNativeError); // Socket.IO native error event
    socket.on(WSMessageType.REJOIN_TOKEN_GENERATED, handleRejoinTokenGenerated);
    socket.on(WSMessageType.LEADERBOARD_UPDATE, handleLeaderboardUpdate);
    socket.on("SCORE_ADJUSTED", handleScoreAdjusted);
    socket.on(WSMessageType.REVEAL_ANSWERS, handleRevealAnswers);
    socket.on(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
    socket.on(WSMessageType.SWAN_CHASE_STATE, handleSwanChaseState);
    socket.on(WSMessageType.SWAN_CHASE_ENDED, handleSwanChaseEnded);

    console.log("[Host] Event listeners registered successfully");

    // Cleanup listeners on unmount or socket change
    return () => {
      console.log("[Host] Cleaning up event listeners");
      socket.offAny(handleAny);
      socket.off(WSMessageType.SESSION_STATE, handleSessionState);
      socket.off(WSMessageType.PLAYER_JOINED, handlePlayerJoined);
      socket.off(WSMessageType.PLAYER_LEFT, handlePlayerLeft);
      socket.off("CONNECTION_STATUS_UPDATE", handleConnectionStatus);
      socket.off(WSMessageType.ANSWER_RECEIVED, handleAnswerReceived);
      socket.off(WSMessageType.ANSWER_COUNT_UPDATED, handleAnswerCountUpdated);
      socket.off(WSMessageType.PLAYER_ANSWERED, handlePlayerAnswered);
      socket.off(WSMessageType.ITEM_LOCKED, handleItemLocked);
      socket.off(WSMessageType.ITEM_CANCELLED, handleItemCancelled);
      socket.off(WSMessageType.SESSION_ENDED, handleSessionEnded);
      socket.off(WSMessageType.SESSION_RESET, handleSessionReset);
      socket.off(WSMessageType.ERROR, handleError);
      socket.off("error", handleNativeError);
      socket.off(WSMessageType.REJOIN_TOKEN_GENERATED, handleRejoinTokenGenerated);
      socket.off(WSMessageType.LEADERBOARD_UPDATE, handleLeaderboardUpdate);
      socket.off("SCORE_ADJUSTED", handleScoreAdjusted);
      socket.off(WSMessageType.REVEAL_ANSWERS, handleRevealAnswers);
      socket.off(WSMessageType.SWAN_CHASE_STARTED, handleSwanChaseStarted);
      socket.off(WSMessageType.SWAN_CHASE_STATE, handleSwanChaseState);
      socket.off(WSMessageType.SWAN_CHASE_ENDED, handleSwanChaseEnded);
    };
  }, [socket, code]); // Only depend on socket, not on isConnected or hasJoinedRoom

  // Fetch session data
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions/code/${code}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Session not found");
          } else if (response.status === 410) {
            // Session is archived
            setError("This session has been archived and can no longer be played. The quiz was updated after this session was created.");
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

  // Countdown timer effect - runs when item is active
  useEffect(() => {
    if (itemState !== "active" || timeRemaining <= 0 || isPaused) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer reached 0 - server will handle auto-lock
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [itemState, timeRemaining, isPaused]);

  // Flatten items for navigation
  const allItems = session?.quiz.rounds.flatMap(round => 
    round.items.map(item => ({ ...item, roundTitle: round.title }))
  ) || [];
  
  // Keep ref in sync for event handlers
  useEffect(() => {
    allItemsRef.current = allItems.map(item => ({
      id: item.id,
      questionType: item.question?.type,
    }));
  }, [allItems]);
  
  const currentItem = allItems[currentItemIndex];
  const totalItems = allItems.length;

  // Host controls
  const startItem = useCallback(() => {
    if (!currentItem) return;
    
    const timerDuration = currentItem.settingsJson?.timer || 30;
    
    send({
      type: WSMessageType.START_ITEM,
      timestamp: Date.now(),
      payload: {
        sessionCode: code,
        itemId: currentItem.id,
        itemType: currentItem.itemType,
        timerDuration,
      },
    });
    
    // Start the countdown timer
    setTimeRemaining(timerDuration);
    setItemState("active");
    setAnsweredCount(0);
    setCurrentItemAnswers([]); // Reset answer panel for new question
    setSelectedHistoryItemId(null); // Clear history selection
  }, [currentItem, code, send]);

  // Cancel current item (stops without scoring, allows restart)
  const cancelItem = useCallback(() => {
    if (!currentItem) return;
    
    send({
      type: WSMessageType.CANCEL_ITEM,
      timestamp: Date.now(),
      payload: {
        sessionCode: code,
        itemId: currentItem.id,
      },
    });
    
    // Reset local state
    setItemState("idle");
    setTimeRemaining(0);
    setAnsweredCount(0);
    // Remove from completed items so it can be re-done
    setCompletedItemIds(prev => {
      const updated = new Set(prev);
      updated.delete(currentItem.id);
      return updated;
    });
  }, [currentItem, code, send]);

  // Note: Lock is now handled automatically by the server-side timer
  // When timer expires, server broadcasts ITEM_LOCKED and we update state via handleItemLocked

  const revealAnswers = useCallback(() => {
    if (!currentItem) return;
    send({
      type: WSMessageType.REVEAL_ANSWERS,
      timestamp: Date.now(),
      payload: { sessionCode: code, itemId: currentItem.id },
    });
    setItemState("revealed");
    // Mark this item as completed
    setCompletedItemIds(prev => new Set([...prev, currentItem.id]));
    // Save answers to history
    setAnswerHistory(prev => {
      const updated = new Map(prev);
      updated.set(currentItem.id, [...currentItemAnswers]);
      return updated;
    });
  }, [code, send, currentItem, currentItemAnswers]);

  const nextItem = useCallback(() => {
    if (currentItemIndex < totalItems - 1) {
      // Save current answers to history before moving
      if (currentItem && currentItemAnswers.length > 0) {
        setAnswerHistory(prev => {
          const updated = new Map(prev);
          updated.set(currentItem.id, [...currentItemAnswers]);
          return updated;
        });
      }
      const nextIndex = currentItemIndex + 1;
      const nextItemData = allItems[nextIndex];
      setCurrentItemIndex(nextIndex);
      setItemState("idle");
      setAnsweredCount(0);
      setTimeRemaining(0);
      setCurrentItemAnswers([]); // Clear for new question
      
      // If next item was completed and has history, auto-select for viewing
      if (nextItemData && completedItemIds.has(nextItemData.id) && answerHistory.has(nextItemData.id)) {
        setSelectedHistoryItemId(nextItemData.id);
      } else {
        setSelectedHistoryItemId(null);
      }
    }
  }, [currentItemIndex, totalItems, currentItem, currentItemAnswers, allItems, completedItemIds, answerHistory]);

  const previousItem = useCallback(() => {
    if (currentItemIndex > 0) {
      // Save current answers to history before moving
      if (currentItem && currentItemAnswers.length > 0) {
        setAnswerHistory(prev => {
          const updated = new Map(prev);
          updated.set(currentItem.id, [...currentItemAnswers]);
          return updated;
        });
      }
      const prevIndex = currentItemIndex - 1;
      const prevItemData = allItems[prevIndex];
      setCurrentItemIndex(prevIndex);
      setItemState("idle");
      setAnsweredCount(0);
      setTimeRemaining(0);
      setCurrentItemAnswers([]); // Clear for new question
      
      // If previous item was completed and has history, auto-select for viewing
      if (prevItemData && completedItemIds.has(prevItemData.id) && answerHistory.has(prevItemData.id)) {
        setSelectedHistoryItemId(prevItemData.id);
      } else {
        setSelectedHistoryItemId(null);
      }
    }
  }, [currentItemIndex, currentItem, currentItemAnswers, allItems, completedItemIds, answerHistory]);

  const startSwanRace = useCallback(() => {
    send({
      type: WSMessageType.START_SWAN_RACE,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setItemState("active");
  }, [code, send]);

  const showScoreboard = useCallback((displayType: "TOP_3" | "TOP_5" | "TOP_10" | "ALL" = scoreboardType) => {
    send({
      type: "SHOW_SCOREBOARD" as any,
      timestamp: Date.now(),
      payload: { 
        sessionCode: code,
        displayType: displayType.toLowerCase(),
      },
    });
    setShowingScoreboard(true);
  }, [code, scoreboardType, send]);

  const hideScoreboard = useCallback(() => {
    // Send event to hide scoreboard on display
    send({
      type: "HIDE_SCOREBOARD" as any,
      timestamp: Date.now(),
      payload: { sessionCode: code },
    });
    setShowingScoreboard(false);
  }, [code, send]);

  const pauseSession = useCallback(() => {
    // Find which round the current item is in
    let itemCounter = 0;
    let roundIndex = 0;
    for (const round of session?.quiz.rounds || []) {
      if (itemCounter + round.items.length > currentItemIndex) {
        break;
      }
      itemCounter += round.items.length;
      roundIndex++;
    }
    
    send({
      type: WSMessageType.PAUSE_SESSION,
      timestamp: Date.now(),
      payload: { 
        sessionCode: code,
        currentRoundIndex: roundIndex,
        currentItemIndex: currentItemIndex,
      },
    });
    setIsPaused(true);
  }, [code, send, currentItemIndex, session?.quiz.rounds]);

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

  const kickPlayer = useCallback((playerId: string, playerName: string) => {
    if (confirm(`Remove "${playerName}" from the session?`)) {
      send({
        type: WSMessageType.KICK_PLAYER,
        timestamp: Date.now(),
        payload: { 
          sessionCode: code,
          playerId,
        },
      });
    }
  }, [code, send]);

  // Generate rejoin link for offline player
  const generateRejoinLink = useCallback((playerId: string) => {
    if (!socket) return;
    setGeneratingToken(playerId);
    socket.emit(WSMessageType.GENERATE_REJOIN_TOKEN, {
      sessionCode: code,
      playerId,
    });
  }, [socket, code]);

  // Adjust score for OPEN_TEXT answers (host manual override)
  const adjustScore = useCallback((answerId: string, playerId: string, itemId: string, scorePercentage: number) => {
    if (!socket) return;
    console.log("[Host] Adjusting score:", { answerId, playerId, itemId, scorePercentage });
    socket.emit("ADJUST_SCORE", {
      sessionCode: code,
      answerId,
      playerId,
      itemId,
      scorePercentage,
    });
  }, [socket, code]);

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
            
            {/* Dev Tools - Quick Player Access (visible for logged-in hosts) */}
            <div className="mt-4 pt-4 border-t border-slate-600">
                <p className="text-xs text-slate-500 text-center mb-2">🛠️ Quick Test</p>
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
          </div>

          {/* Players List */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">
              Players ({session.players.length})
              {!isConnected && (
                <span className="ml-2 text-xs text-yellow-500 normal-case">
                  (offline mode)
                </span>
              )}
            </h3>
            
            {session.players.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Waiting for players to join...
              </p>
            ) : (
              <div className="space-y-2">
                {session.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => {
                    // Use live connection status if available, otherwise show as unknown/offline
                    const liveStatus = liveConnectionStatus.get(player.id);
                    const isOnline = liveStatus?.isOnline ?? false;
                    const quality = liveStatus?.quality || 'unknown';
                    
                    // Determine status color: green=online, yellow=poor, red=offline, gray=unknown
                    let statusColor = "bg-slate-500"; // unknown/not connected
                    let statusTitle = "Connection unknown";
                    const showRejoinButton = !isOnline && isConnected;
                    
                    if (isConnected) {
                      if (isOnline) {
                        if (quality === 'good') {
                          statusColor = "bg-green-400";
                          statusTitle = "Online (good connection)";
                        } else if (quality === 'poor') {
                          statusColor = "bg-yellow-400";
                          statusTitle = "Online (poor connection)";
                        } else {
                          statusColor = "bg-green-400";
                          statusTitle = "Online";
                        }
                      } else {
                        statusColor = "bg-red-500";
                        statusTitle = "Offline - click link icon to generate rejoin link";
                      }
                    }
                    
                    return (
                      <div 
                        key={player.id}
                        className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2 group"
                      >
                        <span className="text-lg font-bold text-slate-500 w-6">
                          {index + 1}
                        </span>
                        <span className="text-xl">{player.avatar || "👤"}</span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-medium text-sm" title={player.name}>{player.name}</p>
                        </div>
                        <span className="font-mono font-bold flex-shrink-0" style={{ color: themeColor }}>
                          {player.score}
                        </span>
                        <span 
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`}
                          title={statusTitle}
                        />
                        {/* Rejoin link button - only show for offline players */}
                        {showRejoinButton && (
                          <button
                            onClick={() => generateRejoinLink(player.id)}
                            disabled={generatingToken === player.id}
                            className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-all"
                            title="Generate rejoin link"
                          >
                            {generatingToken === player.id ? "⏳" : "🔗"}
                          </button>
                        )}
                        <button
                          onClick={() => kickPlayer(player.id, player.name)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-all"
                          title="Remove player"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* Left Players Section - players who left but have answers */}
          {leftPlayers.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <span>📴</span>
                <span>Left ({leftPlayers.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Players who left but earned points
              </p>
              <div className="space-y-2">
                {leftPlayers
                  .sort((a, b) => b.score - a.score)
                  .map((player) => (
                    <div 
                      key={player.id}
                      className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2 group opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <span className="text-xl grayscale">{player.avatar || "👤"}</span>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium text-sm text-slate-400" title={player.name}>{player.name}</p>
                      </div>
                      <span className="font-mono font-bold flex-shrink-0 text-slate-400">
                        {player.score}
                      </span>
                      <span 
                        className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-500"
                        title="Left session"
                      />
                      <button
                        onClick={() => generateRejoinLink(player.id)}
                        disabled={generatingToken === player.id}
                        className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-all"
                        title="Generate rejoin link"
                      >
                        {generatingToken === player.id ? "⏳" : "🔗"}
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
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
                  itemState === "idle" && completedItemIds.has(currentItem.id) ? "bg-green-900/50 text-green-400" :
                  itemState === "idle" ? "bg-slate-700 text-slate-400" :
                  itemState === "active" ? "bg-green-900/50 text-green-400" :
                  itemState === "locked" ? "bg-orange-900/50 text-orange-400" :
                  "bg-blue-900/50 text-blue-400"
                }`}>
                  {itemState === "idle" && completedItemIds.has(currentItem.id) && "✅ Completed"}
                  {itemState === "idle" && !completedItemIds.has(currentItem.id) && "Ready"}
                  {itemState === "active" && "Active"}
                  {itemState === "locked" && "Locked"}
                  {itemState === "revealed" && "Revealed"}
                </span>
              </div>

              {/* Question Content */}
              {currentItem.itemType === "QUESTION" && currentItem.question && (
                <div>
                  <div className="mb-3">
                    <QuestionTypeBadge 
                      type={currentItem.question.type as QuestionType} 
                      size="md"
                    />
                  </div>
                  
                  {/* Photo Grid for PHOTO_ question types */}
                  {requiresPhotos(currentItem.question.type as QuestionType) && currentItem.question.media && currentItem.question.media.length > 0 && (
                    <div className="mb-4">
                      <PhotoGrid 
                        photos={currentItem.question.media.map((m, index) => {
                          const ref = m.reference as any;
                          return {
                            id: m.id,
                            url: ref?.url || ref?.assetUrl || '',
                            width: ref?.width || null,
                            height: ref?.height || null,
                            displayOrder: m.displayOrder ?? index,
                          };
                        })}
                      />
                    </div>
                  )}

                  <h2 className="text-2xl font-bold mb-4">{currentItem.question.prompt}</h2>
                  
                  {currentItem.question.options && (
                    currentItem.question.type === "ORDER" || 
                    currentItem.question.type === "MC_ORDER" || 
                    currentItem.question.type === "PHOTO_MC_ORDER"
                  ) ? (
                    /* ORDER: Show numbered list in correct order */
                    <div className="space-y-2">
                      <p className="text-sm text-slate-400 mb-3">Correcte volgorde:</p>
                      {[...currentItem.question.options]
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((option, idx) => (
                          <div 
                            key={option.id}
                            className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                              itemState === "revealed"
                                ? "border-green-500 bg-green-900/30"
                                : "border-slate-600 bg-slate-700/50"
                            }`}
                          >
                            <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </span>
                            <span>{option.text}</span>
                          </div>
                        ))}
                    </div>
                  ) : currentItem.question.options && 
                       currentItem.question.type !== "NUMERIC" &&
                       currentItem.question.type !== "SLIDER" &&
                       currentItem.question.type !== "PHOTO_NUMERIC" &&
                       currentItem.question.type !== "PHOTO_SLIDER" &&
                       currentItem.question.type !== "ESTIMATION" &&
                       currentItem.question.type !== "OPEN_TEXT" &&
                       currentItem.question.type !== "PHOTO_OPEN_TEXT" &&
                       currentItem.question.type !== "AUDIO_OPEN" &&
                       currentItem.question.type !== "VIDEO_OPEN" && (
                    /* MC/TRUE_FALSE/POLL: Show A, B, C, D grid */
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
                  
                  {/* NUMERIC/SLIDER/ESTIMATION: Show correct number on host */}
                  {(currentItem.question.type === "NUMERIC" ||
                    currentItem.question.type === "SLIDER" ||
                    currentItem.question.type === "PHOTO_NUMERIC" ||
                    currentItem.question.type === "PHOTO_SLIDER" ||
                    currentItem.question.type === "ESTIMATION") && (
                    <div className="bg-slate-700/50 border-2 border-slate-600 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-2">Correct answer:</p>
                      <p className="text-2xl font-bold text-green-400">
                        {currentItem.question.options?.[0]?.text 
                          ? Number(currentItem.question.options[0].text).toLocaleString("en-US")
                          : "Not set"}
                      </p>
                      {currentItem.question.options?.[0]?.order !== undefined && 
                       currentItem.question.options[0].order > 0 && (
                        <p className="text-sm text-slate-400 mt-1">
                          ±{currentItem.question.options[0].order}% margin for full points
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* OPEN_TEXT types: Show correct answer on host */}
                  {(currentItem.question.type === "OPEN_TEXT" ||
                    currentItem.question.type === "PHOTO_OPEN_TEXT" ||
                    currentItem.question.type === "AUDIO_OPEN" ||
                    currentItem.question.type === "VIDEO_OPEN") && 
                    currentItem.question.options?.[0] && (
                    <div className="bg-slate-700/50 border-2 border-slate-600 rounded-lg p-4">
                      <p className="text-sm text-slate-400 mb-2">Correct answer:</p>
                      <p className="text-xl font-bold text-green-400">
                        {currentItem.question.options[0].text}
                      </p>
                    </div>
                  )}

                  {/* Host instructions for OPEN_TEXT scoring */}
                  {(currentItem.question.type === "OPEN_TEXT" ||
                    currentItem.question.type === "PHOTO_OPEN_TEXT" ||
                    currentItem.question.type === "AUDIO_OPEN" ||
                    currentItem.question.type === "VIDEO_OPEN") && (
                    <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 mt-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                          <p className="font-semibold text-amber-300 mb-1">
                            Manual Review Required
                          </p>
                          <p className="text-sm text-amber-200/80">
                            An automatic preliminary score has been assigned based on fuzzy matching. 
                            Review the answers below and adjust the score if needed using the percentage buttons (0%, 25%, 50%, 75%, 100%).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Answer Count */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="bg-slate-700 rounded-lg px-4 py-2">
                      <span className="text-slate-400 text-sm">Answered: </span>
                      <span className="font-bold text-lg">{answeredCount || answerCountsMap[currentItem.id] || 0}</span>
                      <span className="text-slate-400">/{totalPlayerCount || session.players.length}</span>
                    </div>
                  </div>

                  {/* Answer Panel - Show for active/locked/revealed OR when viewing history */}
                  {(() => {
                    const isLiveQuestion = itemState === "active" || itemState === "locked" || itemState === "revealed";
                    const isCompletedWithHistory = completedItemIds.has(currentItem.id) && answerHistory.has(currentItem.id);
                    const isViewingHistory = selectedHistoryItemId === currentItem.id && answerHistory.has(currentItem.id);
                    
                    // Auto-show history for completed items (even without explicit selection)
                    const shouldShowHistory = isViewingHistory || (isCompletedWithHistory && !isLiveQuestion);
                    const answersToShow = shouldShowHistory 
                      ? answerHistory.get(currentItem.id) || []
                      : currentItemAnswers;
                    
                    // Show panel if live question OR has history to show
                    if (!isLiveQuestion && !shouldShowHistory) return null;
                    
                    return (
                      <div className="mt-4">
                        {/* History badge when viewing saved answers */}
                        {shouldShowHistory && !isLiveQuestion && (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">
                              📊 Saved answers ({answersToShow.length})
                            </span>
                          </div>
                        )}
                        <AnswerPanel
                          answers={answersToShow}
                          questionType={currentItem.question?.type}
                          totalPlayers={totalPlayerCount || session.players.length}
                          isExpanded={showAnswerPanel}
                          onToggle={() => setShowAnswerPanel(!showAnswerPanel)}
                          options={currentItem.question?.options?.map(opt => ({
                            id: opt.id,
                            text: opt.text,
                            isCorrect: opt.isCorrect,
                          }))}
                          correctOrder={currentItem.question?.type === "ORDER" || currentItem.question?.type === "MC_ORDER" || currentItem.question?.type === "PHOTO_MC_ORDER"
                            ? currentItem.question?.options
                              ?.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                              .map((opt, idx) => ({
                                id: opt.id,
                                text: opt.text,
                                position: idx + 1,
                              }))
                            : undefined
                          }
                          onAdjustScore={adjustScore}
                        />
                      </div>
                    );
                  })()}
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
                    <>
                      <button
                        onClick={startItem}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
                      >
                        ▶️ Start Question
                      </button>
                      
                      {/* Re-reveal button for completed questions */}
                      {completedItemIds.has(currentItem.id) && (
                        <button
                          onClick={revealAnswers}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                          title="Show answers again on display/player screens"
                        >
                          👁️ Re-reveal Answers
                        </button>
                      )}
                    </>
                  )}
                  
                  {itemState === "active" && (
                    <>
                      <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${
                        timeRemaining <= 5 
                          ? 'bg-red-600 animate-pulse' 
                          : timeRemaining <= 10 
                            ? 'bg-orange-600' 
                            : 'bg-green-600'
                      }`}>
                        <span className="text-2xl tabular-nums">⏱️ {timeRemaining}s</span>
                        <span className="text-sm opacity-75">({answeredCount}/{totalPlayerCount || session?.players.length || 0} answers)</span>
                      </div>
                      <button
                        onClick={cancelItem}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
                        title="Cancel question and allow restart"
                      >
                        ✖️ Cancel
                      </button>
                    </>
                  )}
                  
                  {itemState === "locked" && (
                    <>
                      <button
                        onClick={revealAnswers}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                      >
                        👁️ Reveal Answer
                      </button>
                      <button
                        onClick={cancelItem}
                        className="px-4 py-2 bg-red-600/70 hover:bg-red-600 rounded-lg font-medium transition-colors"
                        title="Cancel question and allow restart"
                      >
                        ✖️ Cancel
                      </button>
                    </>
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

              <div className="w-px bg-slate-600 mx-2" />

              {/* Scoreboard Controls - Always available when no question is active */}
              <div className="flex items-center gap-2">
                {!showingScoreboard ? (
                  <>
                    <select
                      value={scoreboardType}
                      onChange={(e) => setScoreboardType(e.target.value as any)}
                      disabled={itemState === "active"}
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="TOP_3">🏆 Top 3</option>
                      <option value="TOP_5">🎯 Top 5</option>
                      <option value="TOP_10">📋 Top 10</option>
                      <option value="ALL">👥 Iedereen</option>
                    </select>
                    <button
                      onClick={() => showScoreboard()}
                      disabled={itemState === "active"}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
                    >
                      📊 Scoreboard
                    </button>
                  </>
                ) : (
                  <button
                    onClick={hideScoreboard}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium transition-colors"
                  >
                    ✕ Hide Scoreboard
                  </button>
                )}
              </div>

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

          {/* Minigames Section */}
          <div className="bg-slate-800 rounded-xl p-6 border-2 border-purple-600/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-purple-400 uppercase flex items-center gap-2">
                🎮 Minigames
              </h3>
              <span className="text-xs text-slate-500">
                Start fun games between questions
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {/* Swan Chase */}
              <button
                onClick={() => setShowSwanChaseConfig(!showSwanChaseConfig)}
                className={`w-full px-6 py-4 rounded-lg font-medium transition-all text-left ${
                  showSwanChaseConfig 
                    ? 'bg-purple-600 hover:bg-purple-500' 
                    : 'bg-slate-700 hover:bg-slate-600 border-2 border-purple-600/30 hover:border-purple-600/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🦢</span>
                      <span className="font-bold">Swan Chase</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Teams race: boats chase swans in real-time!
                    </p>
                  </div>
                  <span className="text-sm px-3 py-1 bg-slate-900/50 rounded-full">
                    {showSwanChaseConfig ? "Hide ▲" : "Configure ▼"}
                  </span>
                </div>
              </button>

              {/* Placeholder for future minigames */}
              <div className="px-6 py-4 bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-lg text-center text-slate-500 text-sm">
                💡 More minigames coming soon...
              </div>
            </div>
          </div>

          {/* Swan Chase Configuration Panel */}
          {showSwanChaseConfig && (
            <div className="mt-6">
              <SwanChaseConfig
                sessionCode={code}
                players={session.players.map(p => ({
                  id: p.id,
                  name: p.name,
                  avatar: p.avatar ?? null,
                  score: p.score,
                  isOnline: p.isOnline ?? true,
                }))}
                socket={socket}
                isConnected={isConnected}
                gameState={swanChaseState}
              />
            </div>
          )}
        </main>

        {/* Right Sidebar - Quiz Overview */}
        <aside className="w-72 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">
            Quiz Structure
          </h3>
          
          <div className="space-y-4">
            {session.quiz.rounds.map((round, roundIndex) => {
              // Calculate round completion
              const roundItemIds = round.items.map(item => item.id);
              const completedInRound = roundItemIds.filter(id => completedItemIds.has(id)).length;
              const totalInRound = round.items.length;
              const isRoundComplete = completedInRound === totalInRound && totalInRound > 0;
              
              return (
                <div key={round.id} className={`rounded-lg ${isRoundComplete ? "bg-green-900/20 border border-green-800/50" : ""}`}>
                  {/* Round Header */}
                  <div className={`flex items-center justify-between px-2 py-1.5 ${isRoundComplete ? "text-green-400" : ""}`}>
                    <h4 className="font-medium text-sm">
                      {isRoundComplete && <span className="mr-1">✅</span>}
                      Round {roundIndex + 1}: {round.title}
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isRoundComplete 
                        ? "bg-green-800/50 text-green-300" 
                        : completedInRound > 0 
                          ? "bg-blue-800/50 text-blue-300"
                          : "bg-slate-700 text-slate-400"
                    }`}>
                      {completedInRound}/{totalInRound}
                    </span>
                  </div>
                  
                  {/* Round Items */}
                  <div className="space-y-1 px-1 pb-1">
                    {round.items.map((item) => {
                      const globalIndex = allItems.findIndex(i => i.id === item.id);
                      const isActive = globalIndex === currentItemIndex;
                      const isCompleted = completedItemIds.has(item.id);
                      const historyCount = answerHistory.get(item.id)?.length || 0;
                      const isHistorySelected = selectedHistoryItemId === item.id;
                      
                      return (
                        <div key={item.id} className="relative">
                          <button
                            onClick={() => {
                              setCurrentItemIndex(globalIndex);
                              setItemState("idle");
                              // If item has history, auto-select it for viewing
                              if (isCompleted && historyCount > 0) {
                                setSelectedHistoryItemId(item.id);
                              } else {
                                setSelectedHistoryItemId(null);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                              isActive 
                                ? "bg-primary-600 text-white ring-2 ring-primary-400" 
                                : isHistorySelected
                                  ? "bg-blue-900/50 text-blue-300 border border-blue-600"
                                  : isCompleted 
                                    ? "bg-green-900/40 text-green-300 border border-green-800/50"
                                    : "bg-slate-700/30 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            <span className="flex items-center">
                              <span className="mr-2">
                                {item.itemType === "QUESTION" && getQuestionTypeIcon(item.question?.type || "")}
                                {item.itemType === "MINIGAME" && "🎮"}
                                {item.itemType === "SCOREBOARD" && "📊"}
                                {item.itemType === "BREAK" && "☕"}
                              </span>
                              <span className="truncate">
                                {item.itemType === "QUESTION" && item.question?.title}
                                {item.itemType === "MINIGAME" && (item.minigameType || "Minigame")}
                                {item.itemType === "SCOREBOARD" && "Scoreboard"}
                                {item.itemType === "BREAK" && "Break"}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              {/* Show answer count for completed questions */}
                              {isCompleted && historyCount > 0 && (
                                <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded text-slate-300">
                                  {historyCount} 📊
                                </span>
                              )}
                              {isCompleted && (
                                <span className="text-green-400 flex-shrink-0">✓</span>
                              )}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Overall Progress */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">Completed</span>
              <span className="font-medium">
                {completedItemIds.size}/{totalItems}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(completedItemIds.size / totalItems) * 100}%` }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
