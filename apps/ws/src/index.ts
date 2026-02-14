// Load environment variables FIRST before any other imports that use them
import "dotenv/config";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import { pino } from "pino";
import { 
  WSMessageType, 
  validateAnswerComplete, 
  QuestionType,
  getQuestionScoringMode,
  ScoringMode,
  getDefaultTimerForQuestionType,
  getBaseQuestionType,
  // Speed Podium scoring
  calculateSpeedPodium,
  DEFAULT_SPEED_PODIUM_PERCENTAGES,
  type SpeedPodiumResult,
  // WS Event schemas and types
  validateCommand,
  createEventPayload,
  checkInputRateLimit,
  clearInputRateLimit,
  joinSessionCommandSchema,
  playerRejoinCommandSchema,
  hostJoinSessionCommandSchema,
  submitAnswerCommandSchema,
  gameInputCommandSchema,
  startItemCommandSchema,
  lockItemCommandSchema,
  revealAnswersCommandSchema,
  startSwanRaceCommandSchema,
  // Swan Chase imports
  startSwanChaseCommandSchema,
  swanChaseInputCommandSchema,
  swanChaseBoatMoveSchema,
  swanChaseBoatSprintSchema,
  swanChaseSwanMoveSchema,
  swanChaseSwanDashSchema,
  SwanChaseMode,
  type Player,
  type PlayerJoinedEvent,
  type SessionStateEvent,
  type ConnectionStatusUpdateEvent,
} from "@partyquiz/shared";
import {
  redis,
  cacheSessionState,
  getSessionState,
  updateLeaderboard,
  getLeaderboard,
  addActivePlayer,
  removeActivePlayer,
  getActivePlayerCount,
  cachePlayer,
  getPlayer,
  checkRateLimit,
  recordPollVote,
  getPollResults,
} from "@partyquiz/shared/server";
import { prisma } from "./lib/prisma";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fisher-Yates shuffle algorithm - randomly shuffles an array
 * Used to randomize option order for MC, ORDER, and other question types
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Determines if a question type should have its options shuffled
 * 
 * SHUFFLE PHILOSOPHY:
 * - Only shuffle when it's ESSENTIAL to the game mechanic
 * - MC_ORDER: Shuffling IS the challenge (player must reorder items)
 * - MC_SINGLE/MULTIPLE: No benefit - players see all options anyway
 * - TRUE_FALSE: Never shuffle - always "True" then "False" by convention
 * 
 * Benefits of minimal shuffling:
 * - Easier debugging (consistent option order)
 * - Better UX (players see same order as question creator intended)
 * - Simpler code (less Redis operations, fewer edge cases)
 */
function shouldShuffleOptions(questionType: string): boolean {
  // Get base type (strips PHOTO_, AUDIO_, VIDEO_ prefixes)
  const baseType = getBaseQuestionType(questionType as QuestionType).toString().toUpperCase();
  
  // ONLY shuffle ORDER questions - shuffling is the core mechanic
  // For these types, the challenge IS to put items in correct order
  const shuffleTypes = [
    "MC_ORDER",        // Text ordering question
    // PHOTO_MC_ORDER uses same base type, so it's included
  ];
  
  return shuffleTypes.includes(baseType);
}

// =============================================================================
// ANSWER DISPLAY FORMATTING
// =============================================================================

interface QuestionOptionDisplay {
  id: string;
  text: string;
}

/**
 * Formats a player's answer for display in the host answer panel.
 * Converts raw answer data to a human-readable string based on question type.
 */
function formatAnswerForDisplay(
  questionType: string,
  rawAnswer: any,
  options: QuestionOptionDisplay[]
): { display: string; selectedOptionIds?: string[]; submittedOrder?: string[] } {
  // Get base type (strips PHOTO_, AUDIO_, VIDEO_ prefixes)
  const baseType = getBaseQuestionType(questionType as QuestionType).toString().toUpperCase();
  const type = questionType.toUpperCase();
  
  // MC_SINGLE, PHOTO_MC_SINGLE, AUDIO_QUESTION, VIDEO_QUESTION, YOUTUBE_WHO_SAID_IT
  // Answer is a single option ID
  if (
    baseType === "MC_SINGLE" || 
    type === "AUDIO_QUESTION" || 
    type === "VIDEO_QUESTION" || 
    type === "YOUTUBE_WHO_SAID_IT"
  ) {
    const selectedOption = options.find(opt => opt.id === rawAnswer);
    return {
      display: selectedOption?.text || String(rawAnswer),
      selectedOptionIds: rawAnswer ? [rawAnswer] : [],
    };
  }
  
  // MC_MULTIPLE, PHOTO_MC_MULTIPLE - Answer is an array of option IDs
  if (baseType === "MC_MULTIPLE") {
    const selectedIds = Array.isArray(rawAnswer) ? rawAnswer : [];
    const selectedTexts = selectedIds
      .map(id => options.find(opt => opt.id === id)?.text || id)
      .join(", ");
    return {
      display: selectedTexts || "(no selection)",
      selectedOptionIds: selectedIds,
    };
  }
  
  // TRUE_FALSE, PHOTO_TRUE_FALSE - Answer is boolean
  if (baseType === "TRUE_FALSE") {
    const boolVal = rawAnswer === true || rawAnswer === "true";
    const displayText = boolVal ? "True" : "False";
    // Map boolean to the matching option ID so the host answer distribution bar works
    const matchingOption = options.find(opt => {
      const t = opt.text.toLowerCase().trim();
      if (boolVal) return ["true", "yes", "waar", "ja", "correct", "juist"].includes(t);
      return ["false", "no", "onwaar", "nee", "incorrect", "onjuist"].includes(t);
    });
    return {
      display: displayText,
      selectedOptionIds: matchingOption ? [matchingOption.id] : [],
    };
  }
  
  // MC_ORDER, PHOTO_MC_ORDER - Answer is array of option IDs in submitted order
  if (baseType === "MC_ORDER") {
    const orderedIds = Array.isArray(rawAnswer) ? rawAnswer : [];
    const orderedTexts = orderedIds
      .map((id, idx) => `${idx + 1}. ${options.find(opt => opt.id === id)?.text || id}`)
      .join(" → ");
    return {
      display: orderedTexts || "(no order)",
      submittedOrder: orderedIds,
    };
  }
  
  // NUMERIC, PHOTO_NUMERIC, SLIDER, PHOTO_SLIDER, MUSIC_GUESS_YEAR - Answer is a number
  if (baseType === "NUMERIC" || baseType === "SLIDER" || type === "MUSIC_GUESS_YEAR") {
    const num = typeof rawAnswer === "number" ? rawAnswer : parseFloat(rawAnswer);
    return { display: isNaN(num) ? String(rawAnswer) : num.toLocaleString("en-US") };
  }
  
  // OPEN_TEXT, PHOTO_OPEN_TEXT, AUDIO_OPEN, VIDEO_OPEN, MUSIC_GUESS_TITLE, MUSIC_GUESS_ARTIST, 
  // YOUTUBE_SCENE_QUESTION, YOUTUBE_NEXT_LINE - Answer is text string
  // Default: just show the raw answer as string
  return { display: String(rawAnswer || "(leeg)") };
}

// =============================================================================
// TIMER MANAGEMENT - Server-authoritative timers for quiz items
// =============================================================================

interface ItemTimer {
  sessionCode: string;
  itemId: string;
  timerEndsAt: number;      // Absolute timestamp when timer expires
  remainingMs: number;       // Remaining milliseconds (for pause/resume)
  isPaused: boolean;
  timeoutId: NodeJS.Timeout | null;
}

// Active timers per session
const activeTimers = new Map<string, ItemTimer>();

/**
 * Start a timer for a quiz item - auto-locks when timer expires
 */
function startItemTimer(
  sessionCode: string, 
  itemId: string, 
  durationSeconds: number,
  io: Server
): ItemTimer {
  // Clear any existing timer for this session
  clearItemTimer(sessionCode);
  
  const durationMs = durationSeconds * 1000;
  const timerEndsAt = Date.now() + durationMs;
  
  const timeoutId = setTimeout(async () => {
    logger.info({ sessionCode, itemId }, "Timer expired - auto-locking item");
    await autoLockItem(sessionCode, itemId, io);
  }, durationMs);
  
  const timer: ItemTimer = {
    sessionCode,
    itemId,
    timerEndsAt,
    remainingMs: durationMs,
    isPaused: false,
    timeoutId,
  };
  
  activeTimers.set(sessionCode, timer);
  return timer;
}

/**
 * Pause the active timer for a session
 */
function pauseItemTimer(sessionCode: string): number | null {
  const timer = activeTimers.get(sessionCode);
  if (!timer || timer.isPaused) return null;
  
  // Clear the timeout
  if (timer.timeoutId) {
    clearTimeout(timer.timeoutId);
    timer.timeoutId = null;
  }
  
  // Calculate remaining time
  timer.remainingMs = Math.max(0, timer.timerEndsAt - Date.now());
  timer.isPaused = true;
  
  logger.info({ sessionCode, remainingMs: timer.remainingMs }, "Timer paused");
  return timer.remainingMs;
}

/**
 * Resume a paused timer
 */
function resumeItemTimer(sessionCode: string, io: Server): number | null {
  const timer = activeTimers.get(sessionCode);
  if (!timer || !timer.isPaused) return null;
  
  // Restart the timeout with remaining time
  timer.timerEndsAt = Date.now() + timer.remainingMs;
  timer.isPaused = false;
  
  timer.timeoutId = setTimeout(async () => {
    logger.info({ sessionCode, itemId: timer.itemId }, "Timer expired after resume - auto-locking item");
    await autoLockItem(sessionCode, timer.itemId, io);
  }, timer.remainingMs);
  
  logger.info({ sessionCode, remainingMs: timer.remainingMs, timerEndsAt: timer.timerEndsAt }, "Timer resumed");
  return timer.timerEndsAt;
}

/**
 * Clear/cancel the timer for a session
 */
function clearItemTimer(sessionCode: string): void {
  const timer = activeTimers.get(sessionCode);
  if (timer?.timeoutId) {
    clearTimeout(timer.timeoutId);
  }
  activeTimers.delete(sessionCode);
}

/**
 * Get current timer state
 */
function getTimerState(sessionCode: string): { remaining: number; isPaused: boolean } | null {
  const timer = activeTimers.get(sessionCode);
  if (!timer) return null;
  
  const remaining = timer.isPaused 
    ? timer.remainingMs 
    : Math.max(0, timer.timerEndsAt - Date.now());
    
  return { remaining, isPaused: timer.isPaused };
}

/**
 * Auto-lock item when timer expires
 */
async function autoLockItem(sessionCode: string, itemId: string, io: Server): Promise<void> {
  const lockedAt = Date.now();
  
  // Store lock time in Redis
  await redis.set(`session:${sessionCode}:itemLockedAt`, lockedAt.toString());
  
  // Clear the timer
  activeTimers.delete(sessionCode);
  
  // Broadcast ITEM_LOCKED to all clients
  io.to(sessionCode).emit(WSMessageType.ITEM_LOCKED, {
    itemId,
    lockedAt,
    autoLocked: true,
  });
  
  logger.info({ sessionCode, itemId, lockedAt }, "Item auto-locked by timer");
  
  // Process speed podium bonuses if enabled
  await processSpeedPodiumBonuses(sessionCode, itemId, io);
}

/**
 * Process speed podium bonuses after item is locked
 * Calculates top 3 fastest 100% correct answers and awards bonus points
 */
async function processSpeedPodiumBonuses(sessionCode: string, itemId: string, io: Server): Promise<void> {
  try {
    // Get session with quiz scoring settings
    const session = await prisma.liveSession.findUnique({
      where: { code: sessionCode },
      include: {
        quiz: {
          select: {
            scoringSettingsJson: true,
          },
        },
      },
    });
    
    if (!session) {
      logger.warn({ sessionCode }, "Session not found for speed podium");
      return;
    }
    
    const scoringSettings = session.quiz?.scoringSettingsJson as {
      speedPodiumEnabled?: boolean;
      speedPodiumPercentages?: { first: number; second: number; third: number };
    } | null;
    
    // Check if speed podium is enabled
    if (!scoringSettings?.speedPodiumEnabled) {
      logger.debug({ sessionCode }, "Speed podium not enabled, skipping");
      return;
    }
    
    // Get item start time from Redis
    const itemStartedAtStr = await redis.get(`session:${sessionCode}:itemStartedAt`);
    if (!itemStartedAtStr) {
      logger.warn({ sessionCode, itemId }, "No item start time found for speed podium");
      return;
    }
    const itemStartedAt = parseInt(itemStartedAtStr);
    
    // Get all answers for this item
    const answers = await prisma.liveAnswer.findMany({
      where: {
        sessionId: session.id,
        quizItemId: itemId,
      },
      include: {
        player: true,
      },
    });
    
    if (answers.length === 0) {
      logger.debug({ sessionCode, itemId }, "No answers for speed podium");
      return;
    }
    
    // Get base points from Redis for calculating percentage
    const basePointsStr = await redis.get(`session:${sessionCode}:itemBasePoints`);
    const basePoints = basePointsStr ? parseInt(basePointsStr) : 10;
    
    // Prepare answers for podium calculation
    // We need to calculate timeSpentMs from answeredAt
    const answersForPodium = answers
      .filter(a => a.score > 0) // Only consider answers that earned points
      .map(a => {
        const answerTime = a.answeredAt.getTime();
        const timeSpentMs = answerTime - itemStartedAt;
        // Calculate score percentage based on actual score vs possible base score
        // For 100% correct, score should equal basePoints (before bonuses)
        const scorePercentage = Math.round((a.score / basePoints) * 100);
        
        return {
          playerId: a.playerId,
          score: a.score,
          scorePercentage: Math.min(scorePercentage, 100), // Cap at 100%
          timeSpentMs,
        };
      });
    
    // Get podium percentages (use defaults if not set)
    const percentages = scoringSettings.speedPodiumPercentages || DEFAULT_SPEED_PODIUM_PERCENTAGES;
    
    // Calculate podium results
    const podiumResults = calculateSpeedPodium(answersForPodium, percentages);
    
    if (podiumResults.length === 0) {
      logger.debug({ sessionCode, itemId }, "No 100% correct answers for speed podium");
      return;
    }
    
    logger.info({ sessionCode, itemId, podiumResults }, "Speed podium calculated");
    
    // Apply bonus points to each podium winner
    for (const result of podiumResults) {
      // Update database score
      await prisma.liveAnswer.updateMany({
        where: {
          sessionId: session.id,
          quizItemId: itemId,
          playerId: result.playerId,
        },
        data: {
          score: result.finalScore,
        },
      });
      
      // Update Redis leaderboard
      const cachedPlayer = await getPlayer(sessionCode, result.playerId);
      if (cachedPlayer) {
        // Add bonus points to total (base score was already added at submit time)
        const newScore = cachedPlayer.score + result.bonusPoints;
        await updateLeaderboard(sessionCode, result.playerId, newScore);
        await cachePlayer(sessionCode, result.playerId, {
          ...cachedPlayer,
          score: newScore,
        });
      }
    }
    
    // Get player names for the podium results
    const podiumWithNames = await Promise.all(
      podiumResults.map(async (r) => {
        const player = answers.find(a => a.playerId === r.playerId)?.player;
        return {
          ...r,
          playerName: player?.name || "Unknown",
          playerAvatar: player?.avatar || null,
        };
      })
    );
    
    // Emit speed podium results to all clients
    io.to(sessionCode).emit(WSMessageType.SPEED_PODIUM_RESULTS, {
      itemId,
      podium: podiumWithNames.map(p => ({
        position: p.position,
        playerId: p.playerId,
        playerName: p.playerName,
        playerAvatar: p.playerAvatar,
        baseScore: p.baseScore,
        bonusPercentage: p.bonusPercentage,
        bonusPoints: p.bonusPoints,
        finalScore: p.finalScore,
        timeSpentMs: p.timeSpentMs,
      })),
    });
    
    // Update leaderboard for all clients
    const leaderboard = await getLeaderboard(sessionCode, 10);
    const enrichedLeaderboard = await Promise.all(
      leaderboard.map(async (entry) => {
        const player = await getPlayer(sessionCode, entry.playerId);
        return {
          playerId: entry.playerId,
          playerName: player?.name || "Unknown",
          avatar: player?.avatar || null,
          score: entry.score,
        };
      })
    );
    
    io.to(sessionCode).emit(WSMessageType.LEADERBOARD_UPDATE, {
      leaderboard: enrichedLeaderboard,
      totalPlayers: await getActivePlayerCount(sessionCode),
    });
    
    logger.info({ sessionCode, itemId, winners: podiumWithNames.length }, "Speed podium bonuses applied");
  } catch (error) {
    logger.error({ error, sessionCode, itemId }, "Error processing speed podium bonuses");
  }
}

/**
 * Check if item is locked (for validating late answers)
 */
async function isItemLocked(sessionCode: string): Promise<boolean> {
  const lockedAt = await redis.get(`session:${sessionCode}:itemLockedAt`);
  return lockedAt !== null;
}

// =============================================================================
// STATE VALIDATION - Ensure actions are only allowed in correct state
// =============================================================================

type SessionPhase = "LOBBY" | "PLAYING" | "PAUSED" | "ENDED";
type ItemPhase = "NONE" | "ANSWERING" | "LOCKED" | "REVEALING";

interface SessionState {
  phase: SessionPhase;
  itemPhase: ItemPhase;
  currentItemId: string | null;
}

/**
 * Get current session state from Redis
 */
async function getSessionPhase(sessionCode: string): Promise<SessionState> {
  const [paused, currentItem, lockedAt] = await Promise.all([
    redis.get(`session:${sessionCode}:paused`),
    redis.get(`session:${sessionCode}:currentItem`),
    redis.get(`session:${sessionCode}:itemLockedAt`),
  ]);
  
  // Determine session phase
  let phase: SessionPhase = "LOBBY";
  if (paused === "true") {
    phase = "PAUSED";
  } else if (currentItem) {
    phase = "PLAYING";
  }
  
  // Determine item phase
  let itemPhase: ItemPhase = "NONE";
  if (currentItem) {
    if (lockedAt) {
      itemPhase = "LOCKED";
    } else {
      itemPhase = "ANSWERING";
    }
  }
  
  return {
    phase,
    itemPhase,
    currentItemId: currentItem,
  };
}

/**
 * Validate if an action is allowed in current state
 */
function isActionAllowed(
  action: "START_ITEM" | "LOCK_ITEM" | "REVEAL" | "SUBMIT_ANSWER" | "PAUSE" | "RESUME",
  state: SessionState
): { allowed: boolean; reason?: string } {
  switch (action) {
    case "START_ITEM":
      if (state.phase === "PAUSED") {
        return { allowed: false, reason: "Cannot start item while paused" };
      }
      if (state.itemPhase === "ANSWERING") {
        return { allowed: false, reason: "Another item is already active" };
      }
      return { allowed: true };
      
    case "LOCK_ITEM":
      if (state.itemPhase !== "ANSWERING") {
        return { allowed: false, reason: "No active item to lock" };
      }
      return { allowed: true };
      
    case "REVEAL":
      if (state.itemPhase === "NONE") {
        return { allowed: false, reason: "No item to reveal" };
      }
      return { allowed: true };
      
    case "SUBMIT_ANSWER":
      if (state.phase === "PAUSED") {
        return { allowed: false, reason: "Session is paused" };
      }
      if (state.itemPhase !== "ANSWERING") {
        return { allowed: false, reason: "Answers not accepted" };
      }
      return { allowed: true };
      
    case "PAUSE":
      if (state.phase !== "PLAYING") {
        return { allowed: false, reason: "Session not active" };
      }
      return { allowed: true };
      
    case "RESUME":
      if (state.phase !== "PAUSED") {
        return { allowed: false, reason: "Session not paused" };
      }
      return { allowed: true };
      
    default:
      return { allowed: true };
  }
}

// =============================================================================
// END STATE VALIDATION
// =============================================================================

// =============================================================================
// END TIMER MANAGEMENT
// =============================================================================

// Swan Race Game State
interface SwanRaceState {
  sessionCode: string;
  players: Map<string, {
    id: string;
    name: string;
    position: number;
    velocity: number;
    lastStroke: number;
  }>;
  startTime: number;
  finishLine: number;
  finishedPlayers: string[];
  isActive: boolean;
}

const swanRaceGames = new Map<string, SwanRaceState>();

// =============================================================================
// SWAN CHASE GAME (New game mode)
// =============================================================================
import { SwanChaseGameEngine } from "./lib/swan-chase-engine";

const swanChaseGames = new Map<string, SwanChaseGameEngine>();


// Connection Status Tracking
interface PlayerConnection {
  playerId: string;
  playerName: string;
  socketId: string;
  connectedAt: number;
  lastHeartbeat: number;
  isOnline: boolean;
}

const sessionConnections = new Map<string, Map<string, PlayerConnection>>();

function trackPlayerConnection(sessionCode: string, playerId: string, playerName: string, socketId: string, io: Server) {
  if (!sessionConnections.has(sessionCode)) {
    sessionConnections.set(sessionCode, new Map());
  }
  
  const connections = sessionConnections.get(sessionCode)!;
  
  // Check if player already has a connection (single-socket-per-player)
  const existingConnection = connections.get(playerId);
  if (existingConnection && existingConnection.socketId !== socketId) {
    // Disconnect the old socket
    const oldSocket = io.sockets.sockets.get(existingConnection.socketId);
    if (oldSocket) {
      logger.info({ 
        sessionCode, 
        playerId, 
        oldSocketId: existingConnection.socketId, 
        newSocketId: socketId 
      }, "Disconnecting old socket - single socket per player");
      oldSocket.emit("SESSION_TAKEOVER", { 
        message: "You've connected from another device/tab" 
      });
      oldSocket.disconnect(true);
    }
  }
  
  connections.set(playerId, {
    playerId,
    playerName,
    socketId,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    isOnline: true,
  });
  
  logger.info({ sessionCode, playerId, playerName }, "Player connection tracked");
}

function updatePlayerHeartbeat(sessionCode: string, playerId: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return;
  
  const player = connections.get(playerId);
  if (player) {
    player.lastHeartbeat = Date.now();
  }
}

function markPlayerOffline(sessionCode: string, playerId: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return;
  
  const player = connections.get(playerId);
  if (player) {
    player.isOnline = false;
    logger.info({ sessionCode, playerId }, "Player marked offline");
  }
}

// =============================================================================
// DISCONNECT GRACE PERIOD - Prevent premature player removal on refresh/reconnect
// =============================================================================

// Track pending disconnects with their timeout IDs
const pendingDisconnects = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds to reconnect

/**
 * Schedule a player to be marked as left after grace period
 * If they reconnect within the grace period, the disconnect is cancelled
 */
function schedulePlayerDisconnect(
  sessionCode: string, 
  playerId: string, 
  io: Server
): void {
  const key = `${sessionCode}:${playerId}`;
  
  // Cancel any existing pending disconnect
  cancelPendingDisconnect(sessionCode, playerId);
  
  logger.info({ sessionCode, playerId }, "Scheduling player disconnect (grace period started)");
  
  const timeoutId = setTimeout(async () => {
    try {
      logger.info({ sessionCode, playerId }, "Grace period expired - removing player");
      
      // Remove from pending map
      pendingDisconnects.delete(key);
      
      // Now actually mark player as left
      const player = await prisma.livePlayer.update({
        where: { id: playerId },
        data: { leftAt: new Date() },
        include: {
          session: { select: { id: true } },
          _count: { select: { answers: true } },
        },
      });
      
      // Get player's score from Redis or calculate from answers
      const cachedPlayer = await getPlayer(sessionCode, playerId);
      let playerScore = cachedPlayer?.score || 0;
      
      // If no cached score, calculate from database
      if (!playerScore && player._count.answers > 0) {
        const scoreResult = await prisma.liveAnswer.aggregate({
          where: { playerId, sessionId: player.session.id },
          _sum: { score: true },
        });
        playerScore = scoreResult._sum.score || 0;
      }
      
      // Remove from Redis active players
      await removeActivePlayer(sessionCode, playerId);
      
      // Remove from connection tracking
      const connections = sessionConnections.get(sessionCode);
      if (connections) {
        connections.delete(playerId);
      }
      
      // Notify others in the session - include hasAnswers, score, avatar for host UI
      io.to(sessionCode).emit(WSMessageType.PLAYER_LEFT, {
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        score: playerScore,
        hasAnswers: player._count.answers > 0,
      });
      
      // Send updated connection status
      const updatedConnections = getSessionConnections(sessionCode);
      io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
        connections: updatedConnections,
      });
      
      logger.info({ playerId, sessionCode, hasAnswers: player._count.answers > 0, score: playerScore }, "Player removed after grace period");
    } catch (error) {
      logger.error({ error, playerId, sessionCode }, "Error removing player after grace period");
    }
  }, DISCONNECT_GRACE_PERIOD_MS);
  
  pendingDisconnects.set(key, timeoutId);
}

/**
 * Cancel a pending disconnect (player reconnected)
 */
function cancelPendingDisconnect(sessionCode: string, playerId: string): boolean {
  const key = `${sessionCode}:${playerId}`;
  const timeoutId = pendingDisconnects.get(key);
  
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingDisconnects.delete(key);
    logger.info({ sessionCode, playerId }, "Pending disconnect cancelled (player reconnected)");
    return true;
  }
  return false;
}

function getSessionConnections(sessionCode: string) {
  const connections = sessionConnections.get(sessionCode);
  if (!connections) return [];
  
  return Array.from(connections.values()).map(conn => ({
    playerId: conn.playerId,
    playerName: conn.playerName,
    isOnline: conn.isOnline,
    connectedAt: conn.connectedAt,
    lastHeartbeat: conn.lastHeartbeat,
    connectionQuality: getConnectionQuality(conn),
  }));
}

function getConnectionQuality(conn: PlayerConnection): 'good' | 'poor' | 'offline' {
  if (!conn.isOnline) return 'offline';
  
  const timeSinceHeartbeat = Date.now() - conn.lastHeartbeat;
  // Thresholds adjusted for 10-second heartbeat interval
  if (timeSinceHeartbeat > 35000) return 'offline';  // 35s = missed 3+ heartbeats
  if (timeSinceHeartbeat > 20000) return 'poor';     // 20s = missed 1-2 heartbeats
  return 'good';
}

// Find a player's socket by their playerId
function findPlayerSocket(io: any, playerId: string) {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data.playerId === playerId) {
      return socket;
    }
  }
  return null;
}

function startSwanRace(sessionCode: string, playerIds: string[], playerNames: string[]) {
  const players = new Map();
  playerIds.forEach((id, idx) => {
    players.set(id, {
      id,
      name: playerNames[idx] || `Player ${idx + 1}`,
      position: 0,
      velocity: 0,
      lastStroke: Date.now(),
    });
  });

  swanRaceGames.set(sessionCode, {
    sessionCode,
    players,
    startTime: Date.now(),
    finishLine: 800,
    finishedPlayers: [],
    isActive: true,
  });

  logger.info({ sessionCode, playerCount: players.size }, "Swan Race started");
}

function updateSwanRace(sessionCode: string, playerId: string, strokeDuration: number) {
  const game = swanRaceGames.get(sessionCode);
  if (!game || !game.isActive) return null;

  const player = game.players.get(playerId);
  if (!player) return null;

  // Update velocity based on stroke duration
  const timeSinceLastStroke = Date.now() - player.lastStroke;
  const decay = Math.max(0, 1 - (timeSinceLastStroke / 2000)); // Decay over 2 seconds
  
  // Stroke power: longer hold = more power (max 300ms)
  const strokePower = Math.min(strokeDuration / 300, 1) * 15;
  player.velocity = (player.velocity * decay) + strokePower;
  player.lastStroke = Date.now();

  // Update position
  player.position += player.velocity;

  // Check if finished
  if (player.position >= game.finishLine && !game.finishedPlayers.includes(playerId)) {
    game.finishedPlayers.push(playerId);
    logger.info({ sessionCode, playerId, position: game.finishedPlayers.length }, "Player finished Swan Race");
  }

  // Check if race is finished (all players crossed or 60 seconds elapsed)
  const raceTime = Date.now() - game.startTime;
  if (game.finishedPlayers.length === game.players.size || raceTime > 60000) {
    game.isActive = false;
    logger.info({ sessionCode, finishedCount: game.finishedPlayers.length }, "Swan Race ended");
  }

  return {
    players: Array.from(game.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      position: { x: p.position, y: 0 },
      velocity: p.velocity,
    })),
    raceFinished: !game.isActive,
    finalPositions: game.finishedPlayers,
  };
}

function stopSwanRace(sessionCode: string) {
  swanRaceGames.delete(sessionCode);
  logger.info({ sessionCode }, "Swan Race stopped");
}

function stopSwanChase(sessionCode: string) {
  const gameEngine = swanChaseGames.get(sessionCode);
  if (gameEngine) {
    gameEngine.stop();
    swanChaseGames.delete(sessionCode);
    logger.info({ sessionCode }, "Swan Chase stopped and cleaned up");
  }
}

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

const PORT = process.env.WS_PORT || 8080;

// S3 storage config for resolving media URLs (presigned URLs for private buckets)
const S3_ENDPOINT = process.env.S3_ENDPOINT || "";
const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";
const S3_REGION = process.env.S3_REGION || "auto";

// S3 client - only initialize if credentials are available
const s3Client = S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY && S3_BUCKET
  ? new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for Hetzner Object Storage & R2
    })
  : null;

/**
 * Generate a presigned download URL for a private S3/R2 object.
 * URLs expire after 2 hours — safe because:
 * - Bucket stays private (no public access)
 * - URLs are cryptographically signed (can't be guessed/forged)
 * - Time-limited (dead after expiry)
 * - Only sent to players in the active session via WebSocket
 */
async function generatePresignedMediaUrl(storageKey: string, expiresIn: number = 7200): Promise<string | null> {
  if (!s3Client || !S3_BUCKET || !storageKey) {
    logger.warn({ storageKey, hasClient: !!s3Client, hasBucket: !!S3_BUCKET }, "Cannot generate presigned URL - S3 not configured");
    return null;
  }
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error({ error, storageKey }, "Failed to generate presigned URL");
    return null;
  }
}

// Create HTTP server - Socket.io will attach its handlers
const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.APP_BASE_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/ws",
});

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "Client connected");

  // Player joins session with code
  socket.on(
    WSMessageType.JOIN_SESSION,
    async (data: { sessionCode: string; playerName: string; avatar?: string; deviceIdHash?: string }) => {
      try {
        const { sessionCode, playerName, avatar, deviceIdHash } = data;
        logger.info({ sessionCode, playerName, deviceIdHash }, "Player attempting to join session");

        // Validate session exists in database
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
          include: {
            players: {
              where: { leftAt: null },
            },
          },
        });

        if (!session) {
          logger.warn({ sessionCode }, "Session not found");
          socket.emit(WSMessageType.ERROR, {
            message: "Session not found",
            code: "SESSION_NOT_FOUND",
          });
          return;
        }

        if (session.status === "ENDED") {
          logger.warn({ sessionCode }, "Session already ended");
          socket.emit(WSMessageType.ERROR, {
            message: "Session has ended",
            code: "SESSION_ENDED",
          });
          return;
        }

        // Check if this device already has a player in this session
        if (deviceIdHash) {
          const existingPlayer = await prisma.livePlayer.findFirst({
            where: {
              sessionId: session.id,
              deviceIdHash: deviceIdHash,
            },
            orderBy: { joinedAt: "desc" },
          });

          if (existingPlayer) {
            logger.info({ 
              deviceIdHash, 
              existingPlayerId: existingPlayer.id, 
              existingPlayerName: existingPlayer.name 
            }, "Device recognized - player already exists in session");

            // Store pending join data in socket for later use
            socket.data.pendingJoin = {
              sessionCode,
              playerName,
              avatar,
              deviceIdHash,
              sessionId: session.id,
            };

            // Emit device recognized event - let client choose
            socket.emit(WSMessageType.DEVICE_RECOGNIZED, {
              existingPlayer: {
                id: existingPlayer.id,
                name: existingPlayer.name,
                avatar: existingPlayer.avatar,
              },
              newPlayerName: playerName,
            });
            return;
          }
        }

        // Check if player name is already taken in this session (case-insensitive)
        const nameAlreadyTaken = session.players.some(
          (p) => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (nameAlreadyTaken) {
          logger.warn({ sessionCode, playerName }, "Player name already taken in session");
          socket.emit(WSMessageType.ERROR, {
            message: "This name is already in use. Please choose another name.",
            code: "NAME_ALREADY_TAKEN",
          });
          return;
        }

        // No existing player found - create new player
        const player = await prisma.livePlayer.create({
          data: {
            sessionId: session.id,
            name: playerName,
            avatar: avatar || null,
            deviceIdHash: deviceIdHash || `socket-${socket.id}`,
            joinedAt: new Date(),
          },
        });

        logger.info({ playerId: player.id, sessionCode }, "Player joined session");

        // Cache player data in Redis
        await cachePlayer(sessionCode, player.id, {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          score: 0,
        });

        // Add to active players set
        await addActivePlayer(sessionCode, player.id);

        // Initialize leaderboard score
        await updateLeaderboard(sessionCode, player.id, 0);

        // Join socket room
        socket.join(sessionCode);

        // Store player info in socket data
        socket.data.playerId = player.id;
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = session.id;

        // Track connection status (disconnects old socket if player reconnects)
        trackPlayerConnection(sessionCode, player.id, playerName, socket.id, io);

        // Send session state to player (include accessToken for permanent link)
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId: session.id,
          sessionCode: session.code,
          status: session.status,
          playerId: player.id,
          accessToken: player.accessToken, // For permanent player link
          players: session.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: 0, // Score calculated from answers later
          })),
        });

        // Notify others in the session - use consistent nested structure
        const playerData: Player = {
          id: player.id,
          name: playerName,
          avatar: avatar || null,
          score: 0,
          isOnline: true,
        };
        
        // Debug: log room membership before emitting
        const roomSockets = io.sockets.adapter.rooms.get(sessionCode);
        logger.info({ 
          sessionCode, 
          roomSize: roomSockets?.size || 0,
          roomMembers: roomSockets ? Array.from(roomSockets) : [],
          currentSocketId: socket.id
        }, "DEBUG: Room state before PLAYER_JOINED emit");
        
        // Use io.to() instead of socket.to() to ensure ALL clients receive the event
        // This fixes race conditions where host might not be in room yet
        io.to(sessionCode).emit(WSMessageType.PLAYER_JOINED, {
          player: playerData,
        } satisfies PlayerJoinedEvent);
        
        logger.info({ 
          sessionCode, 
          playerId: player.id,
          playerName,
          eventType: WSMessageType.PLAYER_JOINED 
        }, "DEBUG: PLAYER_JOINED event emitted to room");

        // Send connection status update to host
        const connections = getSessionConnections(sessionCode);
        io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
          connections,
        } satisfies ConnectionStatusUpdateEvent);

        logger.info({ playerId: player.id, sessionCode }, "Player joined successfully");
      } catch (error) {
        logger.error({ error }, "Error joining session");
        socket.emit("error", { message: "Failed to join session" });
      }
    }
  );

  // Player chooses to rejoin as existing player (device was recognized)
  socket.on(
    WSMessageType.REJOIN_AS_EXISTING,
    async (data: { playerId: string }) => {
      try {
        const pendingJoin = socket.data.pendingJoin;
        if (!pendingJoin) {
          socket.emit(WSMessageType.ERROR, {
            message: "No pending join request",
            code: "NO_PENDING_JOIN",
          });
          return;
        }

        const { sessionCode, sessionId } = pendingJoin;
        const { playerId } = data;

        logger.info({ sessionCode, playerId }, "Player rejoining as existing player (device recognized)");

        // Verify player exists
        const player = await prisma.livePlayer.findFirst({
          where: { id: playerId, sessionId },
        });

        if (!player) {
          socket.emit(WSMessageType.ERROR, {
            message: "Player not found",
            code: "PLAYER_NOT_FOUND",
          });
          return;
        }

        // If player was marked as left, unmark them
        if (player.leftAt) {
          await prisma.livePlayer.update({
            where: { id: playerId },
            data: { leftAt: null },
          });
        }

        // Get session for player list
        const session = await prisma.liveSession.findUnique({
          where: { id: sessionId },
          include: {
            players: { where: { leftAt: null } },
          },
        });

        // Join socket room
        socket.join(sessionCode);

        // Store player info in socket data
        socket.data.playerId = playerId;
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = sessionId;
        delete socket.data.pendingJoin;

        // Cache player data in Redis
        await cachePlayer(sessionCode, playerId, {
          id: playerId,
          name: player.name,
          avatar: player.avatar,
          score: 0,
        });

        // Add to active players set
        await addActivePlayer(sessionCode, playerId);

        // Track connection
        trackPlayerConnection(sessionCode, playerId, player.name, socket.id, io);

        // Send session state to player
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId,
          sessionCode,
          status: session?.status || "waiting",
          playerId,
          players: session?.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: 0,
          })) || [],
        });

        // Notify others
        const playerData: Player = {
          id: playerId,
          name: player.name,
          avatar: player.avatar,
          score: 0,
          isOnline: true,
        };
        // Use io.to() to broadcast to ALL clients including host
        io.to(sessionCode).emit(WSMessageType.PLAYER_JOINED, { player: playerData });

        // Send connection status update
        const connections = getSessionConnections(sessionCode);
        io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", { connections });

        logger.info({ playerId, sessionCode }, "Player rejoined as existing (device recognized)");
      } catch (error) {
        logger.error({ error }, "Error rejoining as existing player");
        socket.emit("error", { message: "Failed to rejoin" });
      }
    }
  );

  // Player chooses to join as new player (despite device being recognized)
  socket.on(
    WSMessageType.JOIN_AS_NEW,
    async () => {
      try {
        const pendingJoin = socket.data.pendingJoin;
        if (!pendingJoin) {
          socket.emit(WSMessageType.ERROR, {
            message: "No pending join request",
            code: "NO_PENDING_JOIN",
          });
          return;
        }

        const { sessionCode, playerName, avatar, deviceIdHash, sessionId } = pendingJoin;

        logger.info({ sessionCode, playerName }, "Player joining as new (despite device recognized)");

        // Create new player with modified deviceIdHash to avoid future conflicts
        const newDeviceHash = `${deviceIdHash}-${Date.now()}`;
        const player = await prisma.livePlayer.create({
          data: {
            sessionId,
            name: playerName,
            avatar: avatar || null,
            deviceIdHash: newDeviceHash,
            joinedAt: new Date(),
          },
        });

        // Get session for player list
        const session = await prisma.liveSession.findUnique({
          where: { id: sessionId },
          include: {
            players: { where: { leftAt: null } },
          },
        });

        // Join socket room
        socket.join(sessionCode);

        // Store player info in socket data
        socket.data.playerId = player.id;
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = sessionId;
        delete socket.data.pendingJoin;

        // Cache player data in Redis
        await cachePlayer(sessionCode, player.id, {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          score: 0,
        });

        // Add to active players set
        await addActivePlayer(sessionCode, player.id);

        // Initialize leaderboard score
        await updateLeaderboard(sessionCode, player.id, 0);

        // Track connection
        trackPlayerConnection(sessionCode, player.id, player.name, socket.id, io);

        // Send session state to player
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId,
          sessionCode,
          status: session?.status || "waiting",
          playerId: player.id,
          players: session?.players.map((p) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: 0,
          })) || [],
        });

        // Notify others
        const playerData: Player = {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          score: 0,
          isOnline: true,
        };
        // Use io.to() to broadcast to ALL clients including host
        io.to(sessionCode).emit(WSMessageType.PLAYER_JOINED, { player: playerData });

        // Send connection status update
        const connections = getSessionConnections(sessionCode);
        io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", { connections });

        logger.info({ playerId: player.id, sessionCode }, "New player joined (device was recognized but chose new)");
      } catch (error) {
        logger.error({ error }, "Error joining as new player");
        socket.emit("error", { message: "Failed to join as new player" });
      }
    }
  );

  // Host joins session room to receive updates
  socket.on(
    WSMessageType.HOST_JOIN_SESSION,
    async (data: { sessionCode: string }) => {
      try {
        const { sessionCode } = data;
        logger.info({ sessionCode, socketId: socket.id }, "Host joining session room");

        // Validate session exists - get BOTH active and left players
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
          include: {
            players: {
              orderBy: { joinedAt: "asc" },
            },
          },
        });

        if (!session) {
          logger.warn({ sessionCode }, "Session not found for host");
          socket.emit(WSMessageType.ERROR, {
            message: "Session not found",
            code: "SESSION_NOT_FOUND",
          });
          return;
        }
        
        // Separate active and left players
        const activePlayers = session.players.filter(p => p.leftAt === null);
        const leftPlayers = session.players.filter(p => p.leftAt !== null);

        // Join socket room
        socket.join(sessionCode);
        
        // Store session info in socket data
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = session.id;
        socket.data.isHost = true;

        // Get player scores from database (sum of all their answers)
        const playerScores = await prisma.liveAnswer.groupBy({
          by: ['playerId'],
          where: { sessionId: session.id },
          _sum: { score: true },
        });
        const scoreMap = new Map(playerScores.map(p => [p.playerId, p._sum.score || 0]));

        // Get all unique quizItemIds that have been answered (completed items)
        const answeredItems = await prisma.liveAnswer.groupBy({
          by: ['quizItemId'],
          where: { sessionId: session.id },
        });
        const completedItemIds = answeredItems.map(a => a.quizItemId);

        // Get answer counts per item (for restoring answered count on page refresh)
        const answerCounts = await prisma.liveAnswer.groupBy({
          by: ['quizItemId'],
          where: { sessionId: session.id },
          _count: { id: true },
        });
        const answerCountMap: Record<string, number> = {};
        answerCounts.forEach(ac => {
          answerCountMap[ac.quizItemId] = ac._count.id;
        });

        // Get all answers with player info and question info for history restoration
        const allAnswers = await prisma.liveAnswer.findMany({
          where: { sessionId: session.id },
          include: {
            player: { select: { id: true, name: true, avatar: true } },
            quizItem: { 
              include: { 
                question: { 
                  include: { 
                    options: { orderBy: { order: 'asc' } } 
                  } 
                } 
              } 
            },
          },
          orderBy: { answeredAt: 'asc' },
        });

        // Group answers by quizItemId and format for client
        const answerHistoryMap: Record<string, Array<{
          itemId: string;
          playerId: string;
          playerName: string;
          playerAvatar: string | null;
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
          answerId?: string; // For score adjustment
          autoScore?: number;
          autoScorePercentage?: number;
          isManuallyAdjusted?: boolean;
        }>> = {};

        for (const answer of allAnswers) {
          const itemId = answer.quizItemId;
          if (!answerHistoryMap[itemId]) {
            answerHistoryMap[itemId] = [];
          }

          const questionType = answer.quizItem.question?.type || 'UNKNOWN';
          // Use each answer's own question options for formatting (not the current 
          // question's shuffled options, which would be wrong for history items 
          // from different questions)
          const options = (answer.quizItem.question?.options || []).map(opt => ({ id: opt.id, text: opt.text }));
          
          // FIX: Database column is 'payloadJson', not 'answer'
          const rawPayload = answer.payloadJson;
          
          // Safely parse the answer - might be JSON string, plain string, number, or already parsed
          let parsedAnswer: any;
          if (typeof rawPayload === 'string') {
            // Try to parse as JSON, but if it fails, use the raw string
            // (Open text answers are stored as plain strings, not JSON)
            try {
              parsedAnswer = JSON.parse(rawPayload);
            } catch {
              // Not valid JSON - use as-is (e.g., open text answer like "Jaapi")
              parsedAnswer = rawPayload;
            }
          } else {
            parsedAnswer = rawPayload;
          }
          
          // Format the answer display using the same logic as PLAYER_ANSWERED
          const formatted = formatAnswerForDisplay(questionType, parsedAnswer, options);
          
          logger.debug({ 
            questionType, 
            rawPayload, 
            parsedAnswer, 
            formattedDisplay: formatted.display,
            playerName: answer.player.name,
          }, "Formatting answer for history");

          answerHistoryMap[itemId].push({
            itemId,
            playerId: answer.playerId,
            playerName: answer.player.name,
            playerAvatar: answer.player.avatar,
            questionType,
            answerDisplay: formatted.display,
            rawAnswer: parsedAnswer,
            isCorrect: answer.isCorrect,
            score: answer.score,
            maxScore: answer.maxScore ?? undefined, // Maximum possible score
            timeSpentMs: answer.timeSpentMs ?? undefined, // How long player took to answer
            answeredAt: answer.answeredAt.getTime(),
            selectedOptionIds: formatted.selectedOptionIds,
            submittedOrder: formatted.submittedOrder,
            answerId: answer.id, // For score adjustment
            autoScore: (answer as any).autoScore ?? undefined,
            autoScorePercentage: (answer as any).autoScorePercentage ?? undefined,
            isManuallyAdjusted: (answer as any).isManuallyAdjusted ?? false,
          });
        }

        // Filter left players who have answers (they can rejoin)
        const leftPlayersWithAnswers = leftPlayers
          .filter(p => scoreMap.has(p.id) || allAnswers.some(a => a.playerId === p.id))
          .map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: scoreMap.get(p.id) || 0,
            leftAt: p.leftAt?.getTime() || Date.now(),
          }));

        // Send current session state to host
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId: session.id,
          sessionCode: session.code,
          status: session.status,
          isHost: true,
          completedItemIds, // NEW: items that have answers
          answerCounts: answerCountMap, // NEW: answer count per item
          answerHistory: answerHistoryMap, // NEW: full answer history for restoration
          leftPlayersWithAnswers, // NEW: left players who have answers (for rejoin UI)
          players: activePlayers.map((p) => {
            // Check if player has an active connection
            const sessionConns = sessionConnections.get(sessionCode);
            const connection = sessionConns?.get(p.id);
            return {
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              score: scoreMap.get(p.id) || 0, // Use actual score from database
              isOnline: connection?.isOnline ?? false,
              connectionQuality: connection ? getConnectionQuality(connection) : 'unknown',
            };
          }),
        });

        // Also send the current connection status so host knows who's actually online
        const connections = getSessionConnections(sessionCode);
        socket.emit("CONNECTION_STATUS_UPDATE", {
          connections,
        });

        logger.info({ sessionCode, leftPlayersWithAnswers: leftPlayersWithAnswers.length }, "Host joined session room successfully");
      } catch (error) {
        const err = error as Error;
        logger.error({ 
          errorMessage: err?.message, 
          errorStack: err?.stack,
          errorName: err?.name,
        }, "Error joining session as host");
        socket.emit("error", { message: "Failed to join session as host" });
      }
    }
  );

  // Lightweight sync - host requests current player list (used for periodic sync)
  socket.on(
    WSMessageType.REQUEST_SYNC,
    async (data: { sessionCode: string }) => {
      try {
        const { sessionCode } = data;
        
        // Only hosts should request sync
        if (!socket.data.isHost) {
          return;
        }

        // Get current players from database with scores
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
          include: { players: true },
        });

        if (!session) return;

        // Get player scores
        const playerScores = await prisma.liveAnswer.groupBy({
          by: ['playerId'],
          where: { sessionId: session.id },
          _sum: { score: true },
        });
        const scoreMap = new Map(playerScores.map(p => [p.playerId, p._sum.score || 0]));

        // Get connection status
        const sessionConns = sessionConnections.get(sessionCode);

        const players = session.players.map((p) => {
          const connection = sessionConns?.get(p.id);
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: scoreMap.get(p.id) || 0,
            isOnline: connection?.isOnline ?? false,
            connectionQuality: connection ? getConnectionQuality(connection) : 'unknown',
          };
        });

        // Send lightweight sync response
        socket.emit("SYNC_RESPONSE", {
          players,
          playerCount: players.length,
          timestamp: Date.now(),
        });

        logger.debug({ sessionCode, playerCount: players.length }, "Sync response sent to host");
      } catch (error) {
        logger.error({ error }, "Error handling sync request");
      }
    }
  );

  // Get current session state (for late joiners / display catch-up)
  socket.on("GET_SESSION_STATE", async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode, socketId: socket.id }, "Client requesting current session state");

      // Get session from database
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
        include: { players: true },
      });

      if (!session) {
        logger.warn({ sessionCode }, "Session not found for state request");
        return;
      }

      // Check if there's an active minigame
      let activeMinigame: string | null = null;
      let minigameData: any = null;

      // Check Swan Chase
      const swanChaseGame = swanChaseGames.get(sessionCode);
      if (swanChaseGame) {
        activeMinigame = "SWAN_CHASE";
        minigameData = swanChaseGame.getState();
        logger.info({ sessionCode }, "Swan Chase game active - sending state to late joiner");
        
        // Emit both SESSION_STATE and SWAN_CHASE_STARTED to catch up the display
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionCode,
          currentActivity: "SWAN_CHASE",
          activeMinigame: "SWAN_CHASE",
          players: session.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
          })),
        });
        
        socket.emit(WSMessageType.SWAN_CHASE_STARTED, minigameData);
        return;
      }

      // Check Swan Race
      const swanRaceGame = swanRaceGames.get(sessionCode);
      if (swanRaceGame && swanRaceGame.isActive) {
        activeMinigame = "SWAN_RACE";
        logger.info({ sessionCode }, "Swan Race game active - sending state to late joiner");
        
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionCode,
          currentActivity: "SWAN_RACE",
          activeMinigame: "SWAN_RACE",
          players: session.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
          })),
        });
        
        socket.emit("SWAN_RACE_STARTED", {
          sessionCode,
          players: Array.from(swanRaceGame.players.values()),
        });
        return;
      }

      // No active minigame - send normal session state
      socket.emit(WSMessageType.SESSION_STATE, {
        sessionCode,
        currentActivity: null,
        activeMinigame: null,
        players: session.players.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
        })),
      });

      logger.debug({ sessionCode, activeMinigame }, "Session state sent to client");
    } catch (error) {
      logger.error({ error }, "Error handling GET_SESSION_STATE");
    }
  });

  // Player rejoins session (after page navigation/reconnect)
  socket.on(
    WSMessageType.PLAYER_REJOIN,
    async (data: { sessionCode: string; playerId: string }) => {
      try {
        const { sessionCode, playerId } = data;
        logger.info({ sessionCode, playerId, socketId: socket.id }, "Player attempting to rejoin session");

        // Cancel any pending disconnect for this player (they reconnected in time!)
        const wasPending = cancelPendingDisconnect(sessionCode, playerId);
        if (wasPending) {
          logger.info({ sessionCode, playerId }, "Player reconnected within grace period");
        }

        // Validate session exists
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
        });

        if (!session) {
          logger.warn({ sessionCode }, "Session not found for rejoin");
          socket.emit(WSMessageType.ERROR, {
            message: "Session not found",
            code: "SESSION_NOT_FOUND",
          });
          return;
        }

        // Validate player exists and belongs to this session
        const player = await prisma.livePlayer.findFirst({
          where: {
            id: playerId,
            sessionId: session.id,
          },
        });

        if (!player) {
          logger.warn({ sessionCode, playerId }, "Player not found for rejoin");
          socket.emit(WSMessageType.ERROR, {
            message: "Player not found",
            code: "PLAYER_NOT_FOUND",
          });
          return;
        }

        // If player was marked as left, unmark them
        if (player.leftAt) {
          await prisma.livePlayer.update({
            where: { id: playerId },
            data: { leftAt: null },
          });
          logger.info({ playerId }, "Player re-activated after rejoin");
        }

        // Join socket room
        socket.join(sessionCode);

        // Store player info in socket data
        socket.data.playerId = playerId;
        socket.data.sessionCode = sessionCode;
        socket.data.sessionId = session.id;

        // Track connection status (disconnects old socket if player reconnects)
        trackPlayerConnection(sessionCode, playerId, player.name, socket.id, io);

        // Get current item from Redis (if any)
        const currentItemId = await redis.get(`session:${sessionCode}:currentItem`);

        // Send current state to rejoining player
        socket.emit(WSMessageType.SESSION_STATE, {
          sessionId: session.id,
          sessionCode: session.code,
          status: session.status,
          playerId: playerId,
          currentItemId: currentItemId || null,
        });

        // If there's an active item, send it to the player
        if (currentItemId) {
          const itemStartedAt = await redis.get(`session:${sessionCode}:itemStartedAt`);
          const timerDuration = await redis.get(`session:${sessionCode}:itemTimerDuration`);
          const itemLockedAt = await redis.get(`session:${sessionCode}:itemLockedAt`);
          
          // Check if this player has already answered this question
          const existingAnswer = await prisma.liveAnswer.findFirst({
            where: {
              sessionId: session.id,
              playerId: playerId,
              quizItemId: currentItemId,
            },
          });
          
          // Get shuffled options from Redis (stored when item started)
          // This ensures rejoining players see the same shuffled order as other players
          const shuffledOptionsJson = await redis.get(`session:${sessionCode}:shuffledOptions`);
          
          // Fetch the item data to send to the player
          const item = await prisma.quizItem.findUnique({
            where: { id: currentItemId },
            include: {
              question: {
                include: {
                  options: { orderBy: { order: "asc" } },
                  media: { orderBy: { order: "asc" } },
                },
              },
            },
          });

          if (item?.question) {
            const elapsedMs = itemStartedAt ? Date.now() - parseInt(itemStartedAt) : 0;
            const remainingMs = timerDuration ? Math.max(0, parseInt(timerDuration) * 1000 - elapsedMs) : 0;
            
            // Use shuffled options from Redis if available, otherwise use DB order
            let optionsToSend;
            if (shuffledOptionsJson) {
              optionsToSend = JSON.parse(shuffledOptionsJson);
              logger.debug({ playerId }, "Using cached shuffled options for rejoining player");
            } else {
              // Fallback to database order (shouldn't happen normally)
              optionsToSend = item.question.options.map((opt) => ({
                id: opt.id,
                text: opt.text,
              }));
              logger.warn({ playerId }, "No shuffled options in Redis, using DB order");
            }

            // Resolve media URLs (same logic as ITEM_STARTED handler)
            const mediaItems = await Promise.all(item.question.media.map(async (m) => {
              const reference = m.reference as any;
              let url: string | null = null;
              let previewUrl: string | null = null;

              switch (m.provider) {
                case "UPLOAD":
                  url = reference?.url || reference?.assetUrl || null;
                  if (!url && reference?.storageKey) {
                    url = await generatePresignedMediaUrl(reference.storageKey);
                  }
                  previewUrl = reference?.thumbnailUrl || url;
                  break;
                case "SPOTIFY":
                  url = reference?.previewUrl || null;
                  previewUrl = reference?.albumArt || reference?.imageUrl || null;
                  break;
                case "YOUTUBE":
                  url = reference?.videoId ? `https://www.youtube.com/watch?v=${reference.videoId}` : null;
                  previewUrl = reference?.thumbnailUrl || (reference?.videoId ? `https://img.youtube.com/vi/${reference.videoId}/hqdefault.jpg` : null);
                  break;
                default:
                  url = reference?.url || null;
              }

              return {
                id: m.id,
                provider: m.provider,
                mediaType: m.mediaType,
                url,
                previewUrl,
                metadata: m.metadata,
                displayOrder: m.displayOrder,
              };
            }));

            // Calculate timerEndsAt for proper client sync
            const timerEndsAt = itemStartedAt && timerDuration 
              ? parseInt(itemStartedAt) + parseInt(timerDuration) * 1000 
              : Date.now() + remainingMs;

            // Send item started event
            socket.emit(WSMessageType.ITEM_STARTED, {
              itemId: item.id,
              itemType: item.itemType,
              prompt: item.question.prompt,
              questionType: item.question.type,
              options: optionsToSend,
              media: mediaItems,
              mediaUrl: item.question.media?.[0]?.reference || null,
              timerDuration: Math.ceil(remainingMs / 1000), // Remaining seconds
              timerEndsAt: timerEndsAt, // Absolute timestamp for accurate sync
            });

            // If item is locked, send locked state
            if (itemLockedAt || remainingMs === 0) {
              socket.emit(WSMessageType.ITEM_LOCKED, {
                itemId: currentItemId,
                autoLocked: true,
              });
              logger.info({ playerId, currentItemId }, "Item already locked - sent ITEM_LOCKED to rejoining player");
              
              // ALSO send answer status if player already answered (important for score display!)
              if (existingAnswer) {
                socket.emit(WSMessageType.ANSWER_RECEIVED, {
                  playerId,
                  itemId: currentItemId,
                  isCorrect: existingAnswer.isCorrect,
                  score: existingAnswer.score,
                  alreadyAnswered: true,
                });
                logger.info({ playerId, currentItemId, score: existingAnswer.score }, "Sent existing answer status to rejoining player (item locked)");
              }
            } else if (existingAnswer) {
              // Item NOT locked, but player already answered - lock for this player only
              socket.emit(WSMessageType.ANSWER_RECEIVED, {
                playerId,
                itemId: currentItemId,
                isCorrect: existingAnswer.isCorrect,
                score: existingAnswer.score,
                alreadyAnswered: true,
              });
              logger.info({ playerId, currentItemId }, "Player already answered - sent answer status to rejoining player");
            }

            logger.info({ playerId, currentItemId, remainingMs, alreadyAnswered: !!existingAnswer, isLocked: !!itemLockedAt }, "Sent current item state to rejoining player");
          }
        }

        // Check if scoreboard is currently active and send to rejoining player
        const scoreboardState = await redis.get(`session:${sessionCode}:scoreboardActive`);
        if (scoreboardState) {
          const scoreboardData = JSON.parse(scoreboardState);
          socket.emit("SHOW_SCOREBOARD", scoreboardData);
          logger.info({ playerId, sessionCode }, "Sent active scoreboard to rejoining player");
        }

        logger.info({ playerId, sessionCode }, "Player rejoined session successfully");
      } catch (error) {
        logger.error({ error }, "Error rejoining session");
        socket.emit("error", { message: "Failed to rejoin session" });
      }
    }
  );

  // Host starts a quiz item (question/minigame/break)
  socket.on(
    WSMessageType.START_ITEM,
    async (data: { sessionCode: string; itemId: string }) => {
      try {
        const { sessionCode, itemId } = data;
        logger.info({ sessionCode, itemId }, "Host starting item");

        // STATE VALIDATION: Check if action is allowed
        const state = await getSessionPhase(sessionCode);
        const validation = isActionAllowed("START_ITEM", state);
        if (!validation.allowed) {
          socket.emit(WSMessageType.ERROR, { 
            message: validation.reason,
            code: "INVALID_STATE" 
          });
          logger.warn({ sessionCode, state, reason: validation.reason }, "START_ITEM rejected");
          return;
        }

        // Verify session exists
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
        });

        if (!session) {
          socket.emit(WSMessageType.ERROR, { message: "Session not found" });
          return;
        }

        // CLEAN UP: Delete any existing answers for this item (allows restart)
        // This ensures a question can be restarted without needing to cancel first
        const deletedAnswers = await prisma.liveAnswer.deleteMany({
          where: {
            sessionId: session.id,
            quizItemId: itemId,
          },
        });
        if (deletedAnswers.count > 0) {
          logger.info({ sessionCode, itemId, deletedCount: deletedAnswers.count }, "Cleared previous answers for restarted item");
        }

        // Get QuizItem with full question data including options and media
        const quizItem = await prisma.quizItem.findUnique({
          where: { id: itemId },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: "asc" },
                },
                media: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        });

        if (!quizItem) {
          socket.emit(WSMessageType.ERROR, { message: "Quiz item not found" });
          return;
        }

        const startedAt = Date.now();
        const settingsJson = (quizItem.settingsJson as any) || {};
        
        // Get timer duration from settings, or use question-type-specific default
        let timerDuration = settingsJson.timer || settingsJson.timerDuration;
        if (!timerDuration && quizItem.question) {
          // Use type-specific default timer for the question type
          timerDuration = getDefaultTimerForQuestionType(quizItem.question.type);
        }
        timerDuration = timerDuration || 15; // Fallback if no question type
        
        // Get points from settings, default to 1000
        const basePoints = settingsJson.points || settingsJson.basePoints || 10;

        // Store item start time in Redis for scoring calculations
        await redis.set(`session:${sessionCode}:currentItem`, itemId);
        await redis.set(`session:${sessionCode}:itemStartedAt`, startedAt.toString());
        await redis.set(`session:${sessionCode}:itemTimerDuration`, timerDuration.toString());
        await redis.set(`session:${sessionCode}:itemBasePoints`, basePoints.toString());
        
        // CLEAR any previous lock state - new item starts unlocked
        await redis.del(`session:${sessionCode}:itemLockedAt`);
        
        // START SERVER-SIDE TIMER - auto-locks when timer expires
        const timer = startItemTimer(sessionCode, itemId, timerDuration, io);
        const timerEndsAt = timer.timerEndsAt;

        // Build the event payload based on item type
        let eventPayload: any = {
          itemId,
          itemType: quizItem.itemType,
          startedAt,
          timerDuration,
          timerEndsAt,  // Absolute timestamp for client sync
          basePoints,
        };

        // Add question data if this is a QUESTION item
        if (quizItem.itemType === "QUESTION" && quizItem.question) {
          const question = quizItem.question;
          
          // Process media - resolve URLs for different providers
          // Uses presigned URLs for UPLOAD provider (private S3/R2 bucket)
          const mediaItems = await Promise.all(question.media.map(async (m) => {
            const reference = m.reference as any;
            let url: string | null = null;
            let previewUrl: string | null = null;

            switch (m.provider) {
              case "UPLOAD":
                // Try existing URL first, then generate a presigned URL from storageKey
                url = reference?.url || reference?.assetUrl || null;
                if (!url && reference?.storageKey) {
                  url = await generatePresignedMediaUrl(reference.storageKey);
                }
                previewUrl = reference?.thumbnailUrl || url;
                break;
              case "SPOTIFY":
                url = reference?.previewUrl || null;
                previewUrl = reference?.albumArt || reference?.imageUrl || null;
                break;
              case "YOUTUBE":
                url = reference?.videoId ? `https://www.youtube.com/watch?v=${reference.videoId}` : null;
                previewUrl = reference?.thumbnailUrl || (reference?.videoId ? `https://img.youtube.com/vi/${reference.videoId}/hqdefault.jpg` : null);
                break;
              default:
                url = reference?.url || null;
            }

            return {
              id: m.id,
              provider: m.provider,
              mediaType: m.mediaType,
              url,
              previewUrl,
              metadata: m.metadata,
              displayOrder: m.displayOrder,
            };
          }));

          // Prepare options for sending to players
          let optionsToSend = question.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            order: opt.order,
          }));
          
          // Shuffle options for applicable question types
          // This ensures players don't see answers in predictable order
          if (shouldShuffleOptions(question.type)) {
            optionsToSend = shuffleArray(optionsToSend);
            logger.debug({ questionType: question.type }, "Options shuffled for player display");
          }
          
          // Store shuffled options in Redis for rejoin consistency
          // Players who rejoin should see the same shuffled order
          await redis.set(
            `session:${sessionCode}:shuffledOptions`,
            JSON.stringify(optionsToSend),
            "EX",
            3600 // Expire after 1 hour
          );

          eventPayload = {
            ...eventPayload,
            questionType: question.type,
            prompt: question.prompt,
            title: question.title,
            // Send options WITHOUT isCorrect flag - that's secret!
            options: optionsToSend,
            media: mediaItems,
            // Primary media for backward compatibility
            mediaUrl: mediaItems[0]?.url || null,
            mediaType: mediaItems[0]?.mediaType || null,
            mediaProvider: mediaItems[0]?.provider || null,
          };
        } else if (quizItem.itemType === "MINIGAME") {
          eventPayload = {
            ...eventPayload,
            minigameType: quizItem.minigameType,
            minigameSettings: settingsJson,
          };
        } else if (quizItem.itemType === "BREAK" || quizItem.itemType === "SCOREBOARD") {
          eventPayload = {
            ...eventPayload,
            breakSettings: settingsJson,
          };
        }

        // Broadcast to all players in the session
        io.to(sessionCode).emit(WSMessageType.ITEM_STARTED, eventPayload);

        logger.info(
          { 
            sessionCode, 
            itemId, 
            itemType: quizItem.itemType,
            timerDuration,
            hasQuestion: !!quizItem.question,
            optionCount: quizItem.question?.options.length || 0,
            mediaCount: quizItem.question?.media.length || 0,
          }, 
          "Item started successfully"
        );
      } catch (error) {
        logger.error({ error }, "Error starting item");
        socket.emit(WSMessageType.ERROR, { message: "Failed to start item" });
      }
    }
  );

  // Host locks item (no more answers)
  socket.on(WSMessageType.LOCK_ITEM, async (data: { sessionCode: string; itemId?: string }) => {
    try {
      const { sessionCode } = data;
      // Get current item from Redis if not provided
      const itemId = data.itemId || await redis.get(`session:${sessionCode}:currentItem`);
      logger.info({ sessionCode, itemId }, "Host locking item manually");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      const lockedAt = Date.now();
      
      // Store lock time in Redis (blocks late answers)
      await redis.set(`session:${sessionCode}:itemLockedAt`, lockedAt.toString());
      
      // Clear the auto-lock timer (host locked manually)
      clearItemTimer(sessionCode);

      io.to(sessionCode).emit(WSMessageType.ITEM_LOCKED, {
        itemId,
        lockedAt,
        autoLocked: false,
      });

      logger.info({ sessionCode, itemId }, "Item locked manually by host");
      
      // Process speed podium bonuses if enabled
      if (itemId) {
        await processSpeedPodiumBonuses(sessionCode, itemId, io);
      }
    } catch (error) {
      logger.error({ error }, "Error locking item");
      socket.emit("error", { message: "Failed to lock item" });
    }
  });

  // Host cancels current item (stops without scoring, allows restart or next question)
  socket.on(WSMessageType.CANCEL_ITEM, async (data: { sessionCode: string; itemId?: string }) => {
    try {
      const { sessionCode } = data;
      const itemId = data.itemId || await redis.get(`session:${sessionCode}:currentItem`);
      logger.info({ sessionCode, itemId }, "Host cancelling item");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit(WSMessageType.ERROR, { message: "Session not found", code: "NOT_FOUND" });
        return;
      }

      // Clear the auto-lock timer
      clearItemTimer(sessionCode);

      // Clear all item-related Redis keys to reset state
      await redis.del(`session:${sessionCode}:currentItem`);
      await redis.del(`session:${sessionCode}:itemStartedAt`);
      await redis.del(`session:${sessionCode}:itemLockedAt`);
      await redis.del(`session:${sessionCode}:itemTimerDuration`);
      await redis.del(`session:${sessionCode}:itemBasePoints`);
      await redis.del(`session:${sessionCode}:shuffledOptions`);

      // Optionally: Delete answers for this item (so it can be re-done)
      if (itemId) {
        await prisma.liveAnswer.deleteMany({
          where: {
            sessionId: session.id,
            quizItemId: itemId,
          },
        });
        logger.info({ sessionCode, itemId }, "Deleted answers for cancelled item");
      }

      // Broadcast cancellation to all clients
      io.to(sessionCode).emit(WSMessageType.ITEM_CANCELLED, {
        itemId,
        cancelledAt: Date.now(),
      });

      logger.info({ sessionCode, itemId }, "Item cancelled by host");
    } catch (error) {
      logger.error({ error }, "Error cancelling item");
      socket.emit(WSMessageType.ERROR, { message: "Failed to cancel item", code: "CANCEL_ERROR" });
    }
  });

  // Host reveals answers
  socket.on(WSMessageType.REVEAL_ANSWERS, async (data: { sessionCode: string; itemId: string }) => {
    try {
      const { sessionCode, itemId } = data;
      logger.info({ sessionCode, itemId }, "Host revealing answers");

      // STATE VALIDATION: Check if action is allowed
      const state = await getSessionPhase(sessionCode);
      const validation = isActionAllowed("REVEAL", state);
      if (!validation.allowed) {
        socket.emit(WSMessageType.ERROR, { 
          message: validation.reason,
          code: "INVALID_STATE" 
        });
        logger.warn({ sessionCode, state, reason: validation.reason }, "REVEAL rejected");
        return;
      }
      
      // Clear timer when revealing (item is done)
      clearItemTimer(sessionCode);

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Get the quiz item with question and settings
      const quizItem = await prisma.quizItem.findUnique({
        where: { id: itemId },
        include: {
          question: {
            include: {
              options: true,
            },
          },
        },
      });

      // Get answers for current item from database
      const answers = await prisma.liveAnswer.findMany({
        where: {
          sessionId: session.id,
          quizItemId: itemId,
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          answeredAt: "asc",
        },
      });

      // Get ALL players in the session to identify who didn't answer
      const allPlayers = await prisma.livePlayer.findMany({
        where: {
          sessionId: session.id,
        },
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      });

      // Deduplicate answers: if player has multiple answers, keep only the LAST one
      const lastAnswerPerPlayer = new Map<string, typeof answers[0]>();
      for (const a of answers) {
        const existing = lastAnswerPerPlayer.get(a.playerId);
        if (!existing || a.answeredAt > existing.answeredAt) {
          lastAnswerPerPlayer.set(a.playerId, a);
        }
      }
      const deduplicatedAnswers = Array.from(lastAnswerPerPlayer.values());

      // Create a Set of player IDs who answered (from deduplicated set)
      const answeredPlayerIds = new Set(deduplicatedAnswers.map(a => a.playerId));

      // Get settings and check if explanation should be shown
      const settings = (quizItem?.settingsJson as { showExplanation?: boolean } | null) || {};
      const showExplanation = settings.showExplanation === true;

      // Build correct answer data based on question type
      const questionType = quizItem?.question?.type || "";
      const baseType = quizItem?.question?.type 
        ? getBaseQuestionType(quizItem.question.type as QuestionType).toString().toUpperCase()
        : "";
      const settingsJson = (quizItem?.settingsJson as Record<string, unknown>) || {};
      let correctOptionId: string | null = null;
      let correctOptionIds: string[] | null = null;
      let correctOrder: Array<{ id: string; text: string; position: number }> | null = null;
      let correctText: string | null = null;
      let correctNumber: number | null = null;
      let estimationMargin: number | null = null;
      let acceptableAnswers: string[] | null = null;

      if (quizItem?.question?.options) {
        const options = quizItem.question.options;
        
        if (baseType === "MC_ORDER") {
          // ORDER: Send correct order (sorted by 'order' field)
          const sortedOptions = [...options].sort((a, b) => (a.order || 0) - (b.order || 0));
          correctOrder = sortedOptions.map((opt, idx) => ({
            id: opt.id,
            text: opt.text,
            position: idx + 1,
          }));
        } else if (baseType === "MC_MULTIPLE") {
          // MC_MULTIPLE: Send all correct option IDs
          correctOptionIds = options.filter(opt => opt.isCorrect).map(opt => opt.id);
          correctOptionId = correctOptionIds[0] || null; // Backward compatibility
        } else if (baseType === "TRUE_FALSE" || baseType === "MC_SINGLE") {
          // MC_SINGLE/TRUE_FALSE: Send single correct option ID
          const correctOption = options.find(opt => opt.isCorrect);
          correctOptionId = correctOption?.id || null;
        } else if (baseType === "NUMERIC" || 
                   baseType === "SLIDER" ||
                   questionType === "MUSIC_GUESS_YEAR") {
          // NUMERIC/SLIDER/MUSIC_GUESS_YEAR: Send correct number and margin
          if (settingsJson?.correctAnswer !== undefined) {
            correctNumber = parseFloat(String(settingsJson.correctAnswer));
          } else if (options.length > 0) {
            // Fallback: correct answer stored in first option's text
            correctNumber = parseFloat(options[0].text);
          }
          // Get margin for percentage calculation
          if (settingsJson?.estimationMargin !== undefined) {
            estimationMargin = Number(settingsJson.estimationMargin);
          } else if (options.length > 0 && options[0].order !== undefined) {
            estimationMargin = options[0].order;
          } else {
            estimationMargin = 10; // Default 10%
          }
        } else if (baseType === "OPEN_TEXT" ||
                   questionType === "AUDIO_OPEN" || questionType === "VIDEO_OPEN") {
          // Open text types: Send correct text answer and acceptable alternatives
          const correctOptions = options.filter(opt => opt.isCorrect);
          if (correctOptions.length > 0) {
            // Primary correct answer (order 0 or lowest)
            const sortedCorrect = [...correctOptions].sort((a, b) => (a.order || 0) - (b.order || 0));
            correctText = sortedCorrect[0]?.text || null;
            // Additional acceptable answers (remaining correct options)
            if (sortedCorrect.length > 1) {
              acceptableAnswers = sortedCorrect.slice(1).map(opt => opt.text);
            }
          }
          // Also check settingsJson for acceptableAnswers (quiz-item level override)
          if (settingsJson?.acceptableAnswers && Array.isArray(settingsJson.acceptableAnswers)) {
            const fromSettings = settingsJson.acceptableAnswers as string[];
            if (acceptableAnswers) {
              acceptableAnswers = [...acceptableAnswers, ...fromSettings];
            } else {
              acceptableAnswers = fromSettings;
            }
          }
        } else {
          // Default: Find correct option
          const correctOption = options.find(opt => opt.isCorrect);
          correctOptionId = correctOption?.id || null;
        }
      }

      // Prepare options for answer formatting
      const optionsForFormatting = quizItem?.question?.options?.map(opt => ({ id: opt.id, text: opt.text })) || [];

      // Build full question context so player can display correct question on re-reveal
      // (player's currentItem may hold a different question if host navigated back)
      const revealQuestionContext = quizItem?.question ? {
        prompt: quizItem.question.prompt,
        title: quizItem.question.title || null,
        options: quizItem.question.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          order: opt.order,
        })),
        settingsJson: quizItem.settingsJson || {},
      } : null;

      io.to(sessionCode).emit(WSMessageType.REVEAL_ANSWERS, {
        itemId,
        questionType,
        // Full question context for re-reveal support
        questionContext: revealQuestionContext,
        // Single correct option (MC_SINGLE, TRUE_FALSE)
        correctOptionId,
        // Multiple correct options (MC_MULTIPLE)
        correctOptionIds,
        // Correct order for ORDER questions
        correctOrder,
        // Correct text for open-ended questions
        correctText,
        // Alternative acceptable answers for open text
        acceptableAnswers,
        // Correct number for ESTIMATION/MUSIC_GUESS_YEAR
        correctNumber,
        // Margin for estimation scoring (percentage)
        estimationMargin,
        explanation: showExplanation ? quizItem?.question?.explanation : null,
        // Answered players with their scores (deduplicated - last answer per player)
        answers: deduplicatedAnswers.map((a) => {
          const formatted = formatAnswerForDisplay(questionType, a.payloadJson, optionsForFormatting);
          return {
            playerId: a.playerId,
            playerName: a.player.name,
            playerAvatar: a.player.avatar,
            answer: a.payloadJson,
            answerDisplay: formatted.display,
            isCorrect: a.isCorrect,
            points: a.score,
            timeSpentMs: a.timeSpentMs,
            selectedOptionIds: formatted.selectedOptionIds,
            submittedOrder: formatted.submittedOrder,
          };
        }),
        // Players who didn't answer (no answer entry)
        noAnswerPlayers: allPlayers
          .filter(p => !answeredPlayerIds.has(p.id))
          .map(p => ({
            playerId: p.id,
            playerName: p.name,
            playerAvatar: p.avatar,
          })),
      });

      logger.info({ 
        sessionCode, 
        itemId, 
        answerCount: answers.length,
        noAnswerCount: allPlayers.length - answers.length, 
        showExplanation 
      }, "Answers revealed");
    } catch (error) {
      logger.error({ error }, "Error revealing answers");
      socket.emit("error", { message: "Failed to reveal answers" });
    }
  });

  // Host shows scoreboard
  socket.on("SHOW_SCOREBOARD", async (data: { sessionCode: string; displayType?: string }) => {
    try {
      const { sessionCode, displayType = "top10" } = data;
      logger.info({ sessionCode, displayType }, "Host showing scoreboard");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
        include: {
          players: {
            // Include all players (not just active) - scores should be shown even after session ends
            include: {
              answers: {
                select: { score: true },
              },
            },
          },
        },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Calculate scores from answers
      const leaderboard = session.players
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          avatar: p.avatar || "👤",
          totalScore: p.answers.reduce((sum, a) => sum + a.score, 0),
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      // Filter based on displayType
      let displayedPlayers = leaderboard;
      if (displayType === "top_3") {
        displayedPlayers = leaderboard.slice(0, 3);
      } else if (displayType === "top_5") {
        displayedPlayers = leaderboard.slice(0, 5);
      } else if (displayType === "top_10") {
        displayedPlayers = leaderboard.slice(0, 10);
      }

      // Store scoreboard state in Redis for rejoin sync
      await redis.set(
        `session:${sessionCode}:scoreboardActive`,
        JSON.stringify({ displayType, leaderboard: displayedPlayers, totalPlayers: leaderboard.length }),
        "EX",
        3600
      );

      // Broadcast to all clients in session
      io.to(sessionCode).emit("SHOW_SCOREBOARD", {
        displayType,
        leaderboard: displayedPlayers,
        totalPlayers: leaderboard.length,
      });

      logger.info({ sessionCode, displayType, playerCount: displayedPlayers.length }, "Scoreboard shown");
    } catch (error) {
      logger.error({ error }, "Error showing scoreboard");
      socket.emit("error", { message: "Failed to show scoreboard" });
    }
  });

  // Host hides scoreboard
  socket.on("HIDE_SCOREBOARD", async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host hiding scoreboard");

      // Clear scoreboard state from Redis
      await redis.del(`session:${sessionCode}:scoreboardActive`);

      // Broadcast to all clients in session
      io.to(sessionCode).emit("HIDE_SCOREBOARD", {
        sessionCode,
      });

      logger.info({ sessionCode }, "Scoreboard hidden");
    } catch (error) {
      logger.error({ error }, "Error hiding scoreboard");
      socket.emit("error", { message: "Failed to hide scoreboard" });
    }
  });

  // Player submits answer
  socket.on(
    WSMessageType.SUBMIT_ANSWER,
    async (data: { sessionCode: string; itemId: string; answer: any; submittedAtMs?: number }) => {
      try {
        const { sessionCode, itemId, answer, submittedAtMs } = data;
        const playerId = socket.data.playerId;

        logger.info({ playerId, sessionCode, itemId }, "Answer submitted");

        if (!playerId) {
          socket.emit("error", { message: "Player not authenticated" });
          return;
        }

        // Check if session is paused
        const isPaused = await redis.get(`session:${sessionCode}:paused`);
        if (isPaused === "true") {
          socket.emit(WSMessageType.ERROR, {
            message: "Session is paused. Please wait for the host to resume.",
          });
          return;
        }

        // Verify session and player exist
        const session = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
        });

        if (!session) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const player = await prisma.livePlayer.findUnique({
          where: { id: playerId },
        });

        if (!player || player.sessionId !== session.id) {
          socket.emit("error", { message: "Player not in session" });
          return;
        }

        // Rate limiting: max 10 answers per minute per player
        const rateLimitKey = `answer:${playerId}`;
        const rateLimit = await checkRateLimit(rateLimitKey, 10, 60);
        
        if (!rateLimit.allowed) {
          socket.emit(WSMessageType.ERROR, {
            message: "Too many answers. Please slow down.",
            code: "RATE_LIMIT_EXCEEDED",
          });
          logger.warn({ playerId, remaining: rateLimit.remaining }, "Rate limit exceeded");
          return;
        }

        // CHECK IF ITEM IS LOCKED (timer expired or host locked)
        const itemLockedAt = await redis.get(`session:${sessionCode}:itemLockedAt`);
        if (itemLockedAt) {
          socket.emit(WSMessageType.ERROR, {
            message: "Time's up! This question is closed.",
            code: "ITEM_LOCKED",
          });
          logger.info({ playerId, itemId, lockedAt: itemLockedAt }, "Late answer rejected - item locked");
          return;
        }

        // Check if already answered this item (allow overwrite - last answer counts)
        const existingAnswer = await prisma.liveAnswer.findFirst({
          where: {
            sessionId: session.id,
            playerId,
            quizItemId: itemId,
          },
        });

        // Track previous score for leaderboard delta when overwriting
        const previousScore = existingAnswer?.score ?? 0;

        // Get quiz item with question details for validation
        const quizItem = await prisma.quizItem.findUnique({
          where: { id: itemId },
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        });

        if (!quizItem || !quizItem.question) {
          socket.emit("error", { message: "Question not found" });
          return;
        }

        const question = quizItem.question;
        const questionType = question.type as QuestionType;
        
        // Get quiz-level scoring settings from the session's quiz
        const sessionWithQuiz = await prisma.liveSession.findUnique({
          where: { code: sessionCode },
          include: {
            quiz: {
              select: {
                scoringSettingsJson: true,
              },
            },
          },
        });
        const quizScoringSettings = sessionWithQuiz?.quiz?.scoringSettingsJson as {
          streakBonusEnabled?: boolean;
          streakBonusPoints?: number;
          speedPodiumEnabled?: boolean;
          speedPodiumPercentages?: { first: number; second: number; third: number };
        } | null;
        
        // Check if this is a poll - polls don't have scoring, just vote tracking
        const scoringMode = getQuestionScoringMode(questionType);
        if (scoringMode === ScoringMode.NO_SCORE) {
          // Handle as poll vote
          const pollVote = answer; // Answer should be the option ID they voted for
          
          // Record vote in Redis and get updated counts
          const pollResults = await recordPollVote(sessionCode, itemId, pollVote);
          
          // Store the vote in database (for persistence, update if already voted)
          if (existingAnswer) {
            await prisma.liveAnswer.update({
              where: { id: existingAnswer.id },
              data: {
                payloadJson: answer,
                answeredAt: new Date(),
              },
            });
          } else {
            await prisma.liveAnswer.create({
              data: {
                sessionId: session.id,
                playerId,
                quizItemId: itemId,
                payloadJson: answer,
                isCorrect: true, // All poll votes are "correct"
                score: 0, // No score for polls
              },
            });
          }
          
          // Acknowledge to player
          socket.emit(WSMessageType.ANSWER_RECEIVED, {
            itemId,
            timestamp: Date.now(),
            isCorrect: true, // All votes accepted
            score: 0,
            isPoll: true,
          });
          
          // Get total vote count
          const totalVotes = Object.values(pollResults).reduce((sum, count) => sum + count, 0);
          
          // Broadcast updated poll results to everyone in session
          io.to(sessionCode).emit(WSMessageType.POLL_RESULTS, {
            itemId,
            results: pollResults,
            totalVotes,
            options: question.options.map(opt => ({
              id: opt.id,
              text: opt.text,
              votes: pollResults[opt.id] || 0,
              percentage: totalVotes > 0 ? Math.round((pollResults[opt.id] || 0) / totalVotes * 100) : 0,
            })),
          });
          
          // Send PLAYER_ANSWERED to host for poll votes too
          const selectedOption = question.options.find(opt => opt.id === pollVote);
          io.to(sessionCode).emit(WSMessageType.PLAYER_ANSWERED, {
            itemId,
            playerId,
            playerName: player.name,
            playerAvatar: player.avatar,
            questionType: "POLL",
            answerDisplay: selectedOption?.text || String(pollVote),
            rawAnswer: pollVote,
            isCorrect: null, // Polls have no correct answer
            score: 0,
            answeredAt: Date.now(),
            selectedOptionIds: [pollVote],
          });
          
          logger.info({ playerId, itemId, pollVote, totalVotes }, "Poll vote recorded");
          return;
        }

        // Get scoring settings from quizItem.settingsJson and Redis
        const settingsJson = quizItem.settingsJson as any;
        
        // Get base points from Redis (set when item started) or settings
        const redisBasePoints = await redis.get(`session:${sessionCode}:itemBasePoints`);
        const basePoints = redisBasePoints ? parseInt(redisBasePoints) : (settingsJson?.points || 10);
        
        // Get timer duration from Redis or settings
        const redisTimerDuration = await redis.get(`session:${sessionCode}:itemTimerDuration`);
        const timerDurationSec = redisTimerDuration ? parseInt(redisTimerDuration) : (settingsJson?.timer || 4);
        const timeLimitMs = timerDurationSec * 1000;

        // Calculate time spent using Redis startedAt timestamp
        const redisStartedAt = await redis.get(`session:${sessionCode}:itemStartedAt`);
        let timeSpentMs: number | undefined;
        
        if (redisStartedAt) {
          const itemStartedAtMs = parseInt(redisStartedAt);
          const answerTime = submittedAtMs || Date.now();
          timeSpentMs = answerTime - itemStartedAtMs;
          
          // Check if answer is within time limit
          if (timeSpentMs > timeLimitMs) {
            socket.emit(WSMessageType.ERROR, {
              message: "Time is up! Answer not accepted.",
              code: "TIME_EXPIRED",
            });
            logger.warn({ playerId, timeSpentMs, timeLimitMs }, "Answer submitted after time limit");
            return;
          }
        }

        // Get current streak for this player
        const previousAnswers = await prisma.liveAnswer.findMany({
          where: {
            sessionId: session.id,
            playerId,
          },
          orderBy: {
            answeredAt: "desc",
          },
          take: 10, // Check last 10 answers for streak
        });

        let currentStreak = 0;
        for (const prevAnswer of previousAnswers) {
          if (prevAnswer.isCorrect) {
            currentStreak++;
          } else {
            break;
          }
        }

        // Validate and score the answer using the new complete validation
        // This handles TRUE_FALSE (boolean), OLDER_NEWER (string), MCQ (option ID), etc.
        
        // For NUMERIC/SLIDER, get margin from question.options[0].order if not in settingsJson
        const baseType = getBaseQuestionType(questionType as QuestionType).toString().toUpperCase();
        let estimationMargin = settingsJson?.estimationMargin;
        if ((baseType === "NUMERIC" || baseType === "SLIDER") && estimationMargin === undefined && question.options.length > 0) {
          estimationMargin = question.options[0].order || 10;
        }
        
        // For OPEN_TEXT types, extract acceptableAnswers from extra correct options
        let validationAcceptableAnswers = settingsJson?.acceptableAnswers as string[] | undefined;
        if (
          (baseType === "OPEN_TEXT" ||
           questionType === "AUDIO_OPEN" || questionType === "VIDEO_OPEN") &&
          question.options.length > 1
        ) {
          const correctOptions = question.options.filter(opt => opt.isCorrect);
          if (correctOptions.length > 1) {
            // Sort by order to get primary answer first, rest are alternatives
            const sortedCorrect = [...correctOptions].sort((a, b) => (a.order || 0) - (b.order || 0));
            const alternativeOptions = sortedCorrect.slice(1).map(opt => opt.text);
            // Merge with any from settingsJson
            if (validationAcceptableAnswers) {
              validationAcceptableAnswers = [...validationAcceptableAnswers, ...alternativeOptions];
            } else {
              validationAcceptableAnswers = alternativeOptions;
            }
          }
        }
        
        const validation = validateAnswerComplete(
          questionType,
          answer,
          question.options,
          settingsJson,
          {
            basePoints,
            timeSpentMs,
            timeLimitMs,
            currentStreak,
            estimationMargin,
            acceptableAnswers: validationAcceptableAnswers,
            // Pass quiz-level scoring settings
            streakBonusEnabled: quizScoringSettings?.streakBonusEnabled,
            streakBonusPoints: quizScoringSettings?.streakBonusPoints,
            // Speed podium: bonus for top 3 fastest 100% correct (applied at lock time)
            speedPodiumEnabled: quizScoringSettings?.speedPodiumEnabled,
          }
        );

        // Log the validation details for debugging
        logger.debug({ 
          playerId, 
          questionType,
          playerAnswer: answer,
          normalizedAnswer: validation.normalizedPlayerAnswer,
          correctAnswer: validation.correctAnswer,
          answerFormat: validation.answerFormat,
          isCorrect: validation.isCorrect,
          score: validation.score,
        }, "Answer validation details");

        // Store answer in database (update if already exists - last answer counts)
        // For OPEN_TEXT, store auto score separately for host review
        const baseTypeForValidation = getBaseQuestionType(questionType as QuestionType).toString().toUpperCase();
        const isOpenTextType = baseTypeForValidation === "OPEN_TEXT" ||
                               questionType === "AUDIO_OPEN" || questionType === "VIDEO_OPEN";
        
        let liveAnswer;
        if (existingAnswer) {
          // Overwrite existing answer
          liveAnswer = await prisma.liveAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              payloadJson: answer,
              isCorrect: validation.isCorrect,
              score: validation.score,
              maxScore: basePoints,
              timeSpentMs: timeSpentMs ?? null,
              answeredAt: new Date(),
            },
          });
          logger.info({ playerId, itemId, previousScore, newScore: validation.score }, "Answer overwritten");
        } else {
          liveAnswer = await prisma.liveAnswer.create({
            data: {
              sessionId: session.id,
              playerId,
              quizItemId: itemId,
              payloadJson: answer,
              isCorrect: validation.isCorrect,
              score: validation.score,
              maxScore: basePoints,
              timeSpentMs: timeSpentMs ?? null,
            },
          });
        }

        // Acknowledge to player with validation result
        socket.emit(WSMessageType.ANSWER_RECEIVED, {
          itemId,
          timestamp: Date.now(),
          isCorrect: validation.isCorrect,
          score: validation.score,
          scorePercentage: validation.scorePercentage,
          maxScore: basePoints,
          streak: validation.isCorrect ? currentStreak + 1 : 0,
        });

        // Update leaderboard in Redis (handle score delta when overwriting answers)
        const scoreDelta = validation.score - previousScore;
        if (scoreDelta !== 0) {
          // Get player's cached data
          const cachedPlayer = await getPlayer(sessionCode, playerId);
          const newScore = Math.max(0, (cachedPlayer?.score || 0) + scoreDelta);

          // Update Redis leaderboard
          await updateLeaderboard(sessionCode, playerId, newScore);

          // Update cached player data
          await cachePlayer(sessionCode, playerId, {
            ...cachedPlayer,
            score: newScore,
          });

          // Get top 10 from Redis (super fast!)
          const leaderboard = await getLeaderboard(sessionCode, 10);

          // Enrich with player details from cache
          const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
              const player = await getPlayer(sessionCode, entry.playerId);
              return {
                playerId: entry.playerId,
                playerName: player?.name || "Unknown",
                avatar: player?.avatar || "👤",
                totalScore: entry.score,
              };
            })
          );

          // Broadcast updated leaderboard
          io.to(sessionCode).emit(WSMessageType.LEADERBOARD_UPDATE, {
            leaderboard: enrichedLeaderboard,
          });
        }

        // Get total answer count for this item
        const answerCount = await prisma.liveAnswer.count({
          where: {
            sessionId: session.id,
            quizItemId: itemId,
          },
        });

        // Get total player count from Redis (cached)
        const totalPlayers = await getActivePlayerCount(sessionCode);

        // Notify host of answer count
        io.to(sessionCode).emit(WSMessageType.ANSWER_COUNT_UPDATED, {
          itemId,
          count: answerCount,
          total: totalPlayers,
        });

        // Send detailed answer info to host (PLAYER_ANSWERED)
        // Get shuffled options from Redis (if they exist) - players see shuffled order
        let optionsForFormatting = question.options.map(opt => ({ id: opt.id, text: opt.text }));
        const shuffledOptionsJson = await redis.get(`session:${sessionCode}:shuffledOptions`);
        if (shuffledOptionsJson) {
          try {
            optionsForFormatting = JSON.parse(shuffledOptionsJson);
            logger.debug("Using shuffled options for answer formatting");
          } catch (error) {
            logger.warn({ error }, "Failed to parse shuffled options, using original order");
          }
        }
        
        const answerFormatted = formatAnswerForDisplay(
          questionType,
          answer,
          optionsForFormatting
        );

        const playerAnsweredPayload = {
          itemId,
          playerId,
          playerName: player.name,
          playerAvatar: player.avatar,
          questionType,
          answerDisplay: answerFormatted.display,
          rawAnswer: answer,
          isCorrect: validation.isCorrect,
          score: validation.score,
          maxScore: basePoints, // Maximum possible score for this question
          timeSpentMs, // How long it took to answer
          answeredAt: Date.now(),
          selectedOptionIds: answerFormatted.selectedOptionIds,
          submittedOrder: answerFormatted.submittedOrder,
          // For OPEN_TEXT: include auto scoring info for host review
          ...(isOpenTextType ? {
            answerId: liveAnswer.id,
            autoScore: validation.score,
            autoScorePercentage: validation.scorePercentage,
            isManuallyAdjusted: false,
          } : {}),
        };
        
        logger.info({ playerAnsweredPayload }, "Sending PLAYER_ANSWERED to host");
        io.to(sessionCode).emit(WSMessageType.PLAYER_ANSWERED, playerAnsweredPayload);

        logger.info(
          {
            playerId,
            itemId,
            answerId: liveAnswer.id,
            isCorrect: validation.isCorrect,
            score: validation.score,
          },
          "Answer stored and validated"
        );
      } catch (error) {
        logger.error({ error }, "Error submitting answer");
        socket.emit("error", { message: "Failed to submit answer" });
      }
    }
  );

  // Host adjusts player's score for OPEN_TEXT questions
  socket.on(
    "ADJUST_SCORE",
    async (data: { 
      sessionCode: string; 
      answerId: string; 
      playerId: string; 
      itemId: string; 
      scorePercentage: number; // 0, 25, 50, 75, 100
    }) => {
      try {
        const { sessionCode, answerId, playerId, itemId, scorePercentage } = data;
        
        logger.info({ sessionCode, answerId, playerId, scorePercentage }, "Host adjusting score");

        // Verify host is authenticated
        if (!socket.data.isHost) {
          socket.emit("error", { message: "Only host can adjust scores" });
          return;
        }

        // Find the answer
        const answer = await prisma.liveAnswer.findUnique({
          where: { id: answerId },
          include: {
            player: true,
            quizItem: {
              include: {
                question: true,
              },
            },
          },
        });

        if (!answer) {
          socket.emit("error", { message: "Answer not found" });
          return;
        }

        // Calculate new score based on percentage
        const maxScore = answer.maxScore || 10;
        const previousScore = answer.score;
        const newScore = Math.round((scorePercentage / 100) * maxScore);

        // Update the answer with new score
        await prisma.liveAnswer.update({
          where: { id: answerId },
          data: {
            score: newScore,
            isCorrect: newScore > 0,
          },
        });

        // Update leaderboard in Redis
        const scoreDifference = newScore - previousScore;
        if (scoreDifference !== 0) {
          // Calculate total score from DATABASE (source of truth), not Redis
          const totalScoreResult = await prisma.liveAnswer.aggregate({
            where: {
              sessionId: answer.sessionId,
              playerId: playerId,
            },
            _sum: { score: true },
          });
          const newTotalScore = totalScoreResult._sum.score || 0;

          logger.info({
            playerId,
            previousScore,
            newScore,
            scoreDifference,
            newTotalScore,
          }, "Score adjustment calculated from database");

          // Update Redis leaderboard with correct total
          await updateLeaderboard(sessionCode, playerId, newTotalScore);

          // Update cached player data
          const cachedPlayer = await getPlayer(sessionCode, playerId);
          if (cachedPlayer) {
            await cachePlayer(sessionCode, playerId, {
              ...cachedPlayer,
              score: newTotalScore,
            });
          }

          // Broadcast updated leaderboard
          const leaderboard = await getLeaderboard(sessionCode, 10);
          const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
              const player = await getPlayer(sessionCode, entry.playerId);
              return {
                playerId: entry.playerId,
                playerName: player?.name || "Unknown",
                avatar: player?.avatar || "👤",
                totalScore: entry.score,
              };
            })
          );

          io.to(sessionCode).emit(WSMessageType.LEADERBOARD_UPDATE, {
            leaderboard: enrichedLeaderboard,
          });
        }

        // Send SCORE_ADJUSTED event to the player
        const playerSockets = await io.in(sessionCode).fetchSockets();
        for (const playerSocket of playerSockets) {
          if (playerSocket.data.playerId === playerId) {
            playerSocket.emit("SCORE_ADJUSTED", {
              itemId,
              playerId,
              previousScore,
              newScore,
              newScorePercentage: scorePercentage,
              adjustedBy: "host",
            });
          }
        }

        // Also emit to host to confirm
        socket.emit("SCORE_ADJUSTED", {
          itemId,
          playerId,
          previousScore,
          newScore,
          newScorePercentage: scorePercentage,
          adjustedBy: "host",
        });

        logger.info({ 
          answerId, 
          playerId, 
          previousScore, 
          newScore, 
          scorePercentage 
        }, "Score adjusted by host");

      } catch (error) {
        logger.error({ error }, "Error adjusting score");
        socket.emit("error", { message: "Failed to adjust score" });
      }
    }
  );

  // Game input for mini-games (Swan Race, etc.)
  socket.on(WSMessageType.GAME_INPUT, (data: { sessionCode: string; playerId: string; input: any }) => {
    try {
      const { sessionCode, playerId, input } = data;
      logger.debug({ playerId, sessionCode, input }, "Game input received");

      // Handle Swan Race input
      if (input.action === "STROKE") {
        const gameState = updateSwanRace(sessionCode, playerId, input.duration || 0);
        if (gameState) {
          // Broadcast updated game state to all players
          io.to(sessionCode).emit("GAME_STATE", gameState);

          // Award points if race finished
          if (gameState.raceFinished && gameState.finalPositions) {
            gameState.finalPositions.forEach(async (pid, index) => {
              const points = Math.max(10 - index * 2, 1); // 1st: 10pts, 2nd: 8pts, 3rd: 6pts, etc.
              try {
                await updateLeaderboard(sessionCode, pid, points);
                logger.info({ sessionCode, playerId: pid, position: index + 1, points }, "Swan Race points awarded");
              } catch (error) {
                logger.error({ error, playerId: pid }, "Failed to award Swan Race points");
              }
            });

            // Stop the race
            setTimeout(() => stopSwanRace(sessionCode), 3000); // 3 second delay for celebration
          }
        }
      } else {
        // Fallback: broadcast input to all players in session
        socket.to(sessionCode).emit(WSMessageType.GAME_INPUT, {
          playerId,
          input,
        });
      }
    } catch (error) {
      logger.error({ error }, "Error processing game input");
    }
  });

  // Start Swan Race (Host action)
  socket.on(WSMessageType.START_SWAN_RACE, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host starting Swan Race");

      // Get active players from Redis
      const playerKeys = await redis.keys(`session:${sessionCode}:player:*`);
      const players = await Promise.all(
        playerKeys.map(async (key) => {
          const playerData = await redis.get(key);
          return playerData ? JSON.parse(playerData) : null;
        })
      );

      const validPlayers = players.filter((p) => p !== null);
      const playerIds = validPlayers.map((p) => p.id);
      const playerNames = validPlayers.map((p) => p.name);

      if (playerIds.length === 0) {
        socket.emit("error", { message: "No players in session" });
        return;
      }

      // Start the race
      startSwanRace(sessionCode, playerIds, playerNames);

      // Notify all players
      io.to(sessionCode).emit(WSMessageType.SWAN_RACE_STARTED, {
        playerCount: playerIds.length,
      });

      logger.info({ sessionCode, playerCount: playerIds.length }, "Swan Race started successfully");
    } catch (error) {
      logger.error({ error }, "Error starting Swan Race");
      socket.emit("error", { message: "Failed to start Swan Race" });
    }
  });

  // Start Swan Chase (Host action - new game mode)
  socket.on(WSMessageType.START_SWAN_CHASE, async (data: unknown) => {
    try {
      // Validate command
      const command = startSwanChaseCommandSchema.parse(data);
      const { sessionCode, mode, duration, teamAssignments } = command;
      
      logger.info({ sessionCode, mode, duration, teamCount: teamAssignments?.length }, "Host starting Swan Chase");

      // Get active players from Redis
      const playerKeys = await redis.keys(`session:${sessionCode}:player:*`);
      const players = await Promise.all(
        playerKeys.map(async (key) => {
          const playerData = await redis.get(key);
          return playerData ? JSON.parse(playerData) : null;
        })
      );

      const validPlayers = players.filter((p) => p !== null);
      
      // Filter to only assigned players if teamAssignments provided
      let playerIds: string[];
      let playerNames: Map<string, string>;
      
      if (teamAssignments && teamAssignments.length > 0) {
        // Use team assignments from host config
        const assignedPlayerIds = teamAssignments.map((a) => a.playerId);
        const assignedPlayers = validPlayers.filter((p) => assignedPlayerIds.includes(p.id));
        
        playerIds = assignedPlayers.map((p) => p.id);
        playerNames = new Map(assignedPlayers.map((p) => [p.id, p.name]));
        
        logger.info({ 
          sessionCode, 
          blueCount: teamAssignments.filter((a) => a.team === "BLUE").length,
          whiteCount: teamAssignments.filter((a) => a.team === "WHITE").length
        }, "Using team assignments from host");
      } else {
        // Auto-assign teams
        playerIds = validPlayers.map((p) => p.id);
        playerNames = new Map(validPlayers.map((p) => [p.id, p.name]));
        logger.info({ sessionCode, playerCount: playerIds.length }, "Auto-assigning teams");
      }

      if (playerIds.length < 2 || playerIds.length > 12) {
        socket.emit("error", { message: "Swan Chase requires 2-12 players" });
        return;
      }

      // Stop any existing Swan Chase game
      const existingGame = swanChaseGames.get(sessionCode);
      if (existingGame) {
        existingGame.stop();
        swanChaseGames.delete(sessionCode);
      }

      // Create and start new game
      const selectedMode = (mode ?? SwanChaseMode.CLASSIC) as SwanChaseMode;
      const gameEngine = new SwanChaseGameEngine(
        sessionCode,
        selectedMode,
        playerIds,
        playerNames,
        duration,
        teamAssignments // Pass team assignments to engine
      );

      swanChaseGames.set(sessionCode, gameEngine);

      // Start physics loop with state broadcast
      gameEngine.start((gameState) => {
        // Broadcast game state to all clients at 30 FPS
        io.to(sessionCode).emit(WSMessageType.SWAN_CHASE_STATE, gameState);

        // Check if game ended
        if (gameState.status === 'ENDED' && gameState.winner) {
          // Emit end event
          io.to(sessionCode).emit(WSMessageType.SWAN_CHASE_ENDED, {
            winner: gameState.winner,
            players: gameState.players,
            duration: gameState.settings.duration - gameState.timeRemaining,
          });

          // Award points to players based on performance
          setTimeout(async () => {
            for (const player of gameState.players) {
              try {
                const points = player.score;
                if (points > 0) {
                  await updateLeaderboard(sessionCode, player.id, points);
                  logger.info({ sessionCode, playerId: player.id, points, team: player.team }, "Swan Chase points awarded");
                }
              } catch (error) {
                logger.error({ error, playerId: player.id }, "Failed to award Swan Chase points");
              }
            }
            
            // Clean up
            swanChaseGames.delete(sessionCode);
            logger.info({ sessionCode, winner: gameState.winner }, "Swan Chase game cleaned up");
          }, 3000);
        }
      });

      // Notify all clients that game started
      io.to(sessionCode).emit(WSMessageType.SWAN_CHASE_STARTED, {
        mode: mode || SwanChaseMode.TEAM_ESCAPE,
        playerCount: playerIds.length,
        settings: gameEngine.getState().settings,
        players: gameEngine.getState().players.map(p => ({
          id: p.id,
          name: p.name,
          team: p.team,
          type: p.type,
        })),
      });

      logger.info({ sessionCode, playerCount: playerIds.length, mode }, "Swan Chase started successfully");
    } catch (error) {
      logger.error({ error }, "Error starting Swan Chase");
      socket.emit("error", { message: "Failed to start Swan Chase" });
    }
  });

  // Swan Chase player input
  socket.on(WSMessageType.SWAN_CHASE_INPUT, async (data: unknown) => {
    try {
      const command = swanChaseInputCommandSchema.parse(data);
      const { sessionCode, playerId, input } = command;

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        return; // Game not active
      }

      // Handle player input
      gameEngine.handleInput(playerId, input);

    } catch (error) {
      logger.error({ error }, "Error handling Swan Chase input");
    }
  });

  // Boat movement (Blue team)
  socket.on(WSMessageType.BOAT_MOVE, async (data: unknown) => {
    try {
      const command = swanChaseBoatMoveSchema.parse(data);
      const { sessionCode, playerId, angle, speed } = command;

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        return; // Game not active
      }

      // Convert angle/speed to direction vector
      const radians = (angle * Math.PI) / 180;
      const direction = {
        x: Math.cos(radians) * speed,
        y: Math.sin(radians) * speed,
      };

      // Handle boat movement
      gameEngine.handleInput(playerId, {
        direction,
        sprint: false,
      });
    } catch (error) {
      logger.error({ error }, "Error handling boat movement");
    }
  });

  // Boat sprint (Blue team ability)
  socket.on(WSMessageType.BOAT_SPRINT, async (data: unknown) => {
    try {
      const command = swanChaseBoatSprintSchema.parse(data);
      const { sessionCode, playerId } = command;

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        return; // Game not active
      }

      // Handle sprint activation
      gameEngine.handleInput(playerId, {
        direction: { x: 0, y: 0 }, // Will use existing direction
        sprint: true,
      });
      
      logger.info({ sessionCode, playerId }, "Boat sprint activated");
    } catch (error) {
      logger.error({ error }, "Error handling boat sprint");
    }
  });

  // Swan movement (White team)
  socket.on(WSMessageType.SWAN_MOVE, async (data: unknown) => {
    try {
      const command = swanChaseSwanMoveSchema.parse(data);
      const { sessionCode, playerId, angle, speed } = command;

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        return; // Game not active
      }

      // Convert angle/speed to direction vector
      const radians = (angle * Math.PI) / 180;
      const direction = {
        x: Math.cos(radians) * speed,
        y: Math.sin(radians) * speed,
      };

      // Handle swan movement
      gameEngine.handleInput(playerId, {
        direction,
        dash: false,
      });
    } catch (error) {
      logger.error({ error }, "Error handling swan movement");
    }
  });

  // Swan dash (White team ability)
  socket.on(WSMessageType.SWAN_DASH, async (data: unknown) => {
    try {
      const command = swanChaseSwanDashSchema.parse(data);
      const { sessionCode, playerId } = command;

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        return; // Game not active
      }

      // Handle dash activation
      gameEngine.handleInput(playerId, {
        direction: { x: 0, y: 0 }, // Will use existing direction
        dash: true,
      });
      
      logger.info({ sessionCode, playerId }, "Swan dash activated");
    } catch (error) {
      logger.error({ error }, "Error handling swan dash");
    }
  });

  // End Swan Chase game (Host action)
  socket.on(WSMessageType.END_SWAN_CHASE, async (data: unknown) => {
    try {
      const { sessionCode } = data as { sessionCode: string };
      
      logger.info({ sessionCode }, "Host ending Swan Chase");

      const gameEngine = swanChaseGames.get(sessionCode);
      if (!gameEngine) {
        socket.emit("error", { message: "No active Swan Chase game" });
        return;
      }

      // Get final state before stopping
      const finalState = gameEngine.getState();
      
      // Stop the game
      gameEngine.stop();
      swanChaseGames.delete(sessionCode);

      // Broadcast game ended event with final state
      io.to(sessionCode).emit(WSMessageType.SWAN_CHASE_ENDED, {
        winner: finalState.winner,
        players: finalState.players,
        duration: finalState.settings.duration - (finalState.timeRemaining || 0),
        round: finalState.round,
        gameState: finalState,
      });

      // Award points to players
      for (const player of finalState.players) {
        try {
          const points = player.score;
          if (points > 0) {
            await updateLeaderboard(sessionCode, player.id, points);
            logger.info({ 
              sessionCode, 
              playerId: player.id, 
              points, 
              team: player.team,
              status: player.status 
            }, "Swan Chase points awarded");
          }
        } catch (error) {
          logger.error({ error, playerId: player.id }, "Failed to award Swan Chase points");
        }
      }

      logger.info({ sessionCode, winner: finalState.winner }, "Swan Chase ended by host");
    } catch (error) {
      logger.error({ error }, "Error ending Swan Chase");
      socket.emit("error", { message: "Failed to end Swan Chase" });
    }
  });

  // Host ends session
  socket.on(WSMessageType.END_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host ending session");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Update session to ENDED
      await prisma.liveSession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: new Date(),
        },
      });

      // Calculate final scores from answers with additional stats
      const players = await prisma.livePlayer.findMany({
        where: { sessionId: session.id },
        include: {
          answers: {
            select: {
              score: true,
              isCorrect: true,
            },
          },
        },
      });

      // Build leaderboard with stats
      const leaderboard = players
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          avatar: p.avatar || "👤",
          totalScore: p.answers.reduce((sum, a) => sum + a.score, 0),
          correctAnswers: p.answers.filter((a) => a.isCorrect === true).length,
          maxStreak: 0, // Could calculate if we had answeredAt ordering
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      // Also keep legacy finalScores format for backward compatibility
      const finalScores = leaderboard.map((p) => ({
        id: p.playerId,
        name: p.playerName,
        score: p.totalScore,
      }));

      // Store final leaderboard in Redis for GET_LEADERBOARD requests
      await redis.set(
        `session:${sessionCode}:finalLeaderboard`,
        JSON.stringify(leaderboard),
        "EX",
        3600 // Expire after 1 hour
      );

      io.to(sessionCode).emit(WSMessageType.SESSION_ENDED, {
        sessionId: session.id,
        endedAt: Date.now(),
        finalScores,
        leaderboard, // Include leaderboard in correct format
      });

      logger.info({ sessionCode, playerCount: players.length }, "Session ended");
    } catch (error) {
      logger.error({ error }, "Error ending session");
      socket.emit("error", { message: "Failed to end session" });
    }
  });

  // Player requests leaderboard (for results page after session ends)
  socket.on("GET_LEADERBOARD", async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode, socketId: socket.id }, "Player requesting leaderboard");

      // First, try to get cached final leaderboard from Redis
      const cachedLeaderboard = await redis.get(`session:${sessionCode}:finalLeaderboard`);
      if (cachedLeaderboard) {
        const leaderboard = JSON.parse(cachedLeaderboard);
        socket.emit(WSMessageType.LEADERBOARD_UPDATE, {
          leaderboard,
        });
        logger.info({ sessionCode, playerCount: leaderboard.length }, "Sent cached final leaderboard");
        return;
      }

      // If no cache, calculate from database
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      const players = await prisma.livePlayer.findMany({
        where: { sessionId: session.id },
        include: {
          answers: {
            select: {
              score: true,
              isCorrect: true,
            },
          },
        },
      });

      const leaderboard = players
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          avatar: p.avatar || "👤",
          totalScore: p.answers.reduce((sum, a) => sum + a.score, 0),
          correctAnswers: p.answers.filter((a) => a.isCorrect === true).length,
          maxStreak: 0,
        }))
        .sort((a, b) => b.totalScore - a.totalScore);

      socket.emit(WSMessageType.LEADERBOARD_UPDATE, {
        leaderboard,
      });

      logger.info({ sessionCode, playerCount: leaderboard.length }, "Sent calculated leaderboard");
    } catch (error) {
      logger.error({ error }, "Error getting leaderboard");
      socket.emit("error", { message: "Failed to get leaderboard" });
    }
  });

  // Host resets session (restart from beginning)
  socket.on(WSMessageType.RESET_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;
      logger.info({ sessionCode }, "Host resetting session");

      // Verify session exists
      const session = await prisma.liveSession.findUnique({
        where: { code: sessionCode },
      });

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      // Reset session status to LOBBY
      await prisma.liveSession.update({
        where: { id: session.id },
        data: {
          status: "LOBBY",
          endedAt: null,
        },
      });

      // Clear all answers for this session
      await prisma.liveAnswer.deleteMany({
        where: { sessionId: session.id },
      });

      // Reset all players (clear leftAt so they're active again)
      await prisma.livePlayer.updateMany({
        where: { sessionId: session.id },
        data: { leftAt: null },
      });

      // Clear Redis session state
      await redis.del(`session:${sessionCode}:currentItem`);
      await redis.del(`session:${sessionCode}:itemStartedAt`);
      await redis.del(`session:${sessionCode}:itemTimerDuration`);
      await redis.del(`session:${sessionCode}:itemBasePoints`);
      await redis.del(`session:${sessionCode}:shuffledOptions`);
      await redis.del(`session:${sessionCode}:paused`);
      await redis.del(`session:${sessionCode}:pausedAt`);

      // Get updated player list
      const players = await prisma.livePlayer.findMany({
        where: { 
          sessionId: session.id,
          leftAt: null,
        },
        orderBy: { joinedAt: "asc" },
      });

      // Notify all clients that session was reset
      io.to(sessionCode).emit(WSMessageType.SESSION_RESET, {
        sessionId: session.id,
        status: "LOBBY",
        players: players.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: 0,
          isOnline: true,
        })),
      });

      logger.info({ sessionCode, playerCount: players.length }, "Session reset to LOBBY");
    } catch (error) {
      logger.error({ error }, "Error resetting session");
      socket.emit("error", { message: "Failed to reset session" });
    }
  });

  // Pause session
  socket.on(WSMessageType.PAUSE_SESSION, async (data: { sessionCode: string; currentRoundIndex?: number; currentItemIndex?: number }) => {
    try {
      const { sessionCode, currentRoundIndex, currentItemIndex } = data;

      logger.info({ sessionCode, currentRoundIndex, currentItemIndex }, "Pausing session");

      // Store pause state in Redis
      await redis.set(`session:${sessionCode}:paused`, "true");
      await redis.set(`session:${sessionCode}:pausedAt`, Date.now().toString());
      
      // PAUSE THE TIMER - saves remaining time
      const remainingMs = pauseItemTimer(sessionCode);

      // Update the database with progress and pause status
      try {
        const session = await prisma.liveSession.findFirst({
          where: { code: sessionCode },
        });
        
        if (session) {
          await prisma.liveSession.update({
            where: { id: session.id },
            data: {
              status: "PAUSED",
              pausedAt: new Date(),
              ...(currentRoundIndex !== undefined && { currentRoundIndex }),
              ...(currentItemIndex !== undefined && { currentItemIndex }),
            },
          });
          logger.info({ sessionId: session.id }, "Session progress saved to database");
        }
      } catch (dbError) {
        logger.error({ dbError }, "Failed to update session in database (continuing anyway)");
      }

      // Notify all clients
      io.to(sessionCode).emit(WSMessageType.SESSION_PAUSED, {
        sessionCode,
        pausedAt: Date.now(),
        remainingMs: remainingMs || 0,
      });

      logger.info({ sessionCode, remainingMs }, "Session paused with timer");
    } catch (error) {
      logger.error({ error }, "Error pausing session");
      socket.emit("error", { message: "Failed to pause session" });
    }
  });

  // Resume session
  socket.on(WSMessageType.RESUME_SESSION, async (data: { sessionCode: string }) => {
    try {
      const { sessionCode } = data;

      logger.info({ sessionCode }, "Resuming session");

      // Remove pause state from Redis
      await redis.del(`session:${sessionCode}:paused`);
      await redis.del(`session:${sessionCode}:pausedAt`);
      
      // RESUME THE TIMER - restarts countdown with remaining time
      const timerEndsAt = resumeItemTimer(sessionCode, io);

      // Update the database to clear pause status
      try {
        const session = await prisma.liveSession.findFirst({
          where: { code: sessionCode },
        });
        
        if (session) {
          await prisma.liveSession.update({
            where: { id: session.id },
            data: {
              status: "ACTIVE",
              pausedAt: null,
            },
          });
          logger.info({ sessionId: session.id }, "Session resumed in database");
        }
      } catch (dbError) {
        logger.error({ dbError }, "Failed to update session in database (continuing anyway)");
      }

      // Notify all clients
      io.to(sessionCode).emit(WSMessageType.SESSION_RESUMED, {
        sessionCode,
        resumedAt: Date.now(),
        timerEndsAt: timerEndsAt || null,
      });

      logger.info({ sessionCode, timerEndsAt }, "Session resumed with timer");
    } catch (error) {
      logger.error({ error }, "Error resuming session");
      socket.emit("error", { message: "Failed to resume session" });
    }
  });


  // Kick player from session (host only)
  socket.on(WSMessageType.KICK_PLAYER, async (data: { sessionCode: string; playerId: string; reason?: string }) => {
    try {
      const { sessionCode, playerId, reason } = data;

      logger.info({ sessionCode, playerId, reason }, "Host kicking player");

      // Find the player with answer count
      const player = await prisma.livePlayer.findUnique({
        where: { id: playerId },
        include: {
          session: { select: { id: true } },
          _count: { select: { answers: true } },
        },
      });

      if (!player) {
        socket.emit(WSMessageType.ERROR, { message: "Player not found" });
        return;
      }
      
      // Get player's score from Redis or calculate from answers
      const cachedPlayer = await getPlayer(sessionCode, playerId);
      let playerScore = cachedPlayer?.score || 0;
      
      // If no cached score, calculate from database
      if (!playerScore && player._count.answers > 0) {
        const scoreResult = await prisma.liveAnswer.aggregate({
          where: { playerId, sessionId: player.session.id },
          _sum: { score: true },
        });
        playerScore = scoreResult._sum.score || 0;
      }

      // Mark player as left in database
      await prisma.livePlayer.update({
        where: { id: playerId },
        data: { leftAt: new Date() },
      });

      // Remove from Redis active players
      await removeActivePlayer(sessionCode, playerId);

      // Remove from connection tracking
      markPlayerOffline(sessionCode, playerId);

      // Find the kicked player's socket and disconnect them
      const kickedPlayerSocket = findPlayerSocket(io, playerId);
      if (kickedPlayerSocket) {
        // Send kick notification to the kicked player BEFORE disconnecting
        kickedPlayerSocket.emit(WSMessageType.PLAYER_KICKED, {
          playerId,
          reason: reason || "You have been removed from the session by the host",
        });
        // Disconnect their socket after a short delay to ensure message is sent
        setTimeout(() => {
          kickedPlayerSocket.disconnect(true);
        }, 100);
      }

      // Notify all other clients that player left - include hasAnswers, score, avatar for host UI
      socket.to(sessionCode).emit(WSMessageType.PLAYER_LEFT, {
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        score: playerScore,
        hasAnswers: player._count.answers > 0,
        kicked: true,
      });

      // Update connection status for host
      const connections = getSessionConnections(sessionCode);
      io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
        connections,
      });

      logger.info({ sessionCode, playerId, playerName: player.name }, "Player kicked successfully");
    } catch (error) {
      logger.error({ error }, "Error kicking player");
      socket.emit(WSMessageType.ERROR, { message: "Failed to kick player" });
    }
  });

  // Generate rejoin token for a player (host only)
  socket.on(
    WSMessageType.GENERATE_REJOIN_TOKEN,
    async (data: { sessionCode: string; playerId: string }) => {
      try {
        const { sessionCode, playerId } = data;

        if (!socket.data.isHost) {
          socket.emit(WSMessageType.ERROR, {
            message: "Only host can generate rejoin tokens",
            code: "NOT_HOST",
          });
          return;
        }

        logger.info({ sessionCode, playerId }, "Host generating rejoin token for player");

        // Verify player exists
        const player = await prisma.livePlayer.findUnique({
          where: { id: playerId },
          include: { session: true },
        });

        if (!player || player.session.code !== sessionCode) {
          socket.emit(WSMessageType.ERROR, {
            message: "Player not found in this session",
            code: "PLAYER_NOT_FOUND",
          });
          return;
        }

        // Generate a simple token (playerId + timestamp + random)
        const token = Buffer.from(
          JSON.stringify({
            playerId,
            sessionCode,
            createdAt: Date.now(),
            random: Math.random().toString(36).substring(2),
          })
        ).toString("base64url");

        // Store token in Redis with 1 hour expiry
        await redis.set(`rejoin:${token}`, playerId, "EX", 3600);

        // Send token back to host
        socket.emit(WSMessageType.REJOIN_TOKEN_GENERATED, {
          playerId,
          playerName: player.name,
          token,
          expiresIn: 3600,
        });

        logger.info({ playerId, playerName: player.name }, "Rejoin token generated");
      } catch (error) {
        logger.error({ error }, "Error generating rejoin token");
        socket.emit(WSMessageType.ERROR, { message: "Failed to generate rejoin token" });
      }
    }
  );

  // Handle heartbeat for connection tracking
  socket.on("HEARTBEAT", () => {
    const playerId = socket.data.playerId;
    const sessionCode = socket.data.sessionCode;

    if (playerId && sessionCode) {
      updatePlayerHeartbeat(sessionCode, playerId);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    try {
      const playerId = socket.data.playerId;
      const sessionCode = socket.data.sessionCode;

      logger.info({ socketId: socket.id, playerId, sessionCode }, "Client disconnected");

      if (!playerId || !sessionCode) {
        return;
      }

      // Mark player as offline in connection tracking (immediate visual feedback)
      markPlayerOffline(sessionCode, playerId);

      // Send connection status update to host (shows player as offline, not removed)
      const connections = getSessionConnections(sessionCode);
      io.to(sessionCode).emit("CONNECTION_STATUS_UPDATE", {
        connections,
      });

      // Schedule player removal after grace period
      // If they reconnect within 30 seconds, the disconnect is cancelled
      schedulePlayerDisconnect(sessionCode, playerId, io);

      logger.info({ playerId, sessionCode }, "Player disconnect scheduled (30s grace period)");
    } catch (error) {
      logger.error({ error }, "Error handling disconnect");
    }
  });
});

// Health check endpoint - runs after Socket.io attaches its handlers
// Socket.io handles /ws routes, this handles /health and /healthz
httpServer.on("request", async (req, res) => {
  // Socket.io handles its own routes (/ws/*), so we only handle health checks here
  if (req.url === "/healthz" || req.url === "/health") {
    try {
      const activeSessions = await prisma.liveSession.count({
        where: { status: { in: ["WAITING", "ACTIVE"] } },
      });
      const totalPlayers = await prisma.livePlayer.count({
        where: { leftAt: null },
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        activeSessions,
        totalPlayers,
      }));
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", message: "Database connection failed" }));
    }
  }
  // Note: Don't return 404 for other routes - Socket.io's engine.io handles /ws/*
  // If it's not /health and not /ws, the request just won't be responded to
  // which will cause a timeout. That's acceptable for unknown routes.
});

// Start server
httpServer.listen(PORT, () => {
  logger.info({ port: PORT, path: "/ws" }, "WebSocket server started");
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...");
  io.close(() => {
    httpServer.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  io.close(() => {
    httpServer.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
});
