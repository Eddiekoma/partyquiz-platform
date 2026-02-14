/**
 * WebSocket Event Schemas
 * 
 * This file defines all WebSocket event payloads with Zod validation.
 * Used by both server (validation) and client (type safety).
 * 
 * Event naming convention:
 * - Commands (client → server): Action verbs (JOIN_SESSION, SUBMIT_ANSWER)
 * - Events (server → client): Past tense or state (PLAYER_JOINED, SESSION_STATE)
 */

import { z } from "zod";

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Player info - consistent structure across all events
 */
export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().nullable().optional(),
  score: z.number().default(0),
  isOnline: z.boolean().default(true),
});

export type Player = z.infer<typeof playerSchema>;

/**
 * Connection status for a player
 */
export const connectionStatusSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  isOnline: z.boolean(),
  connectedAt: z.number(),
  lastHeartbeat: z.number(),
  connectionQuality: z.enum(["good", "poor", "offline"]),
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/**
 * Standard event envelope - all events include these fields
 */
export const eventEnvelopeSchema = z.object({
  sessionId: z.string().optional(),
  sessionCode: z.string(),
  timestamp: z.number().default(() => Date.now()),
  stateVersion: z.number().optional(),
});

// ============================================================================
// CLIENT → SERVER COMMANDS
// ============================================================================

/**
 * Player joins a session
 */
export const joinSessionCommandSchema = z.object({
  sessionCode: z.string().length(6),
  playerName: z.string().min(1).max(50),
  avatar: z.string().nullable().optional(),
});

export type JoinSessionCommand = z.infer<typeof joinSessionCommandSchema>;

/**
 * Player rejoins after disconnect/navigation
 */
export const playerRejoinCommandSchema = z.object({
  sessionCode: z.string().length(6),
  playerId: z.string(),
});

export type PlayerRejoinCommand = z.infer<typeof playerRejoinCommandSchema>;

/**
 * Host joins session room
 */
export const hostJoinSessionCommandSchema = z.object({
  sessionCode: z.string().length(6),
});

export type HostJoinSessionCommand = z.infer<typeof hostJoinSessionCommandSchema>;

/**
 * Player submits an answer
 */
export const submitAnswerCommandSchema = z.object({
  sessionCode: z.string(),
  itemId: z.string(),
  answer: z.any(), // Flexible - validated per question type
  answeredAt: z.number().optional(),
});

export type SubmitAnswerCommand = z.infer<typeof submitAnswerCommandSchema>;

/**
 * Game input (for minigames like Swan Race)
 */
export const gameInputCommandSchema = z.object({
  sessionCode: z.string(),
  input: z.object({
    direction: z.object({
      x: z.number().min(-1).max(1),
      y: z.number().min(-1).max(1),
    }),
    throttle: z.number().min(0).max(1),
  }),
  sequence: z.number().optional(), // For ordering/deduplication
});

export type GameInputCommand = z.infer<typeof gameInputCommandSchema>;

/**
 * Host starts an item (question/minigame)
 */
export const startItemCommandSchema = z.object({
  sessionCode: z.string(),
  itemId: z.string(),
});

export type StartItemCommand = z.infer<typeof startItemCommandSchema>;

/**
 * Host locks answers for current item
 */
export const lockItemCommandSchema = z.object({
  sessionCode: z.string(),
  itemId: z.string().optional(),
});

export type LockItemCommand = z.infer<typeof lockItemCommandSchema>;

/**
 * Host reveals answers
 */
export const revealAnswersCommandSchema = z.object({
  sessionCode: z.string(),
  itemId: z.string().optional(),
});

export type RevealAnswersCommand = z.infer<typeof revealAnswersCommandSchema>;

/**
 * Host starts Swan Race minigame
 */
export const startSwanRaceCommandSchema = z.object({
  sessionCode: z.string(),
  duration: z.number().default(60),
});

export type StartSwanRaceCommand = z.infer<typeof startSwanRaceCommandSchema>;

// ============================================================================
// SERVER → CLIENT EVENTS
// ============================================================================

/**
 * Full session state (sent on join/rejoin)
 */
export const sessionStateEventSchema = z.object({
  sessionId: z.string(),
  sessionCode: z.string(),
  status: z.string(),
  playerId: z.string().optional(), // For player clients
  currentItemId: z.string().nullable().optional(),
  players: z.array(playerSchema).optional(),
  stateVersion: z.number().optional(),
});

export type SessionStateEvent = z.infer<typeof sessionStateEventSchema>;

/**
 * Player joined the session
 */
export const playerJoinedEventSchema = z.object({
  player: playerSchema, // Always nested under 'player' for consistency
});

export type PlayerJoinedEvent = z.infer<typeof playerJoinedEventSchema>;

/**
 * Player left the session
 */
export const playerLeftEventSchema = z.object({
  playerId: z.string(),
  reason: z.enum(["disconnect", "kicked", "left"]).default("disconnect"),
});

export type PlayerLeftEvent = z.infer<typeof playerLeftEventSchema>;

/**
 * Connection status update (presence)
 */
export const connectionStatusUpdateEventSchema = z.object({
  connections: z.array(connectionStatusSchema),
});

export type ConnectionStatusUpdateEvent = z.infer<typeof connectionStatusUpdateEventSchema>;

/**
 * Item started (question/minigame begins)
 */
export const itemStartedEventSchema = z.object({
  itemId: z.string(),
  itemType: z.string(),
  prompt: z.string().optional(),
  questionType: z.string().optional(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).optional(),
  mediaUrl: z.any().optional(), // Flexible for different media types
  timerDuration: z.number().optional(),
  // Media-specific fields
  spotify: z.object({
    trackId: z.string(),
    albumArt: z.string().nullable(),
    startMs: z.number().default(0),
    durationMs: z.number().default(30000),
  }).optional(),
  youtube: z.object({
    videoId: z.string(),
    startSeconds: z.number().default(0),
    endSeconds: z.number().optional(),
  }).optional(),
});

export type ItemStartedEvent = z.infer<typeof itemStartedEventSchema>;

/**
 * Answer received confirmation
 */
export const answerReceivedEventSchema = z.object({
  playerId: z.string(),
  itemId: z.string(),
  isCorrect: z.boolean().optional(), // Only sent to player, not broadcast
  pointsAwarded: z.number().optional(),
});

export type AnswerReceivedEvent = z.infer<typeof answerReceivedEventSchema>;

/**
 * Answer count update (for host/display)
 */
export const answerCountUpdateEventSchema = z.object({
  itemId: z.string(),
  answeredCount: z.number(),
  totalPlayers: z.number(),
  answeredPlayerIds: z.array(z.string()).optional(),
});

export type AnswerCountUpdateEvent = z.infer<typeof answerCountUpdateEventSchema>;

/**
 * Player answered event (sent to host with full answer details)
 * Allows host to see who answered what in real-time
 */
export const playerAnsweredEventSchema = z.object({
  itemId: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  playerAvatar: z.string().nullable().optional(),
  questionType: z.string(), // QuestionType enum value
  // Answer display - formatted for human reading based on question type
  answerDisplay: z.string(), // e.g. "Paris", "True", "1, 2, 3, 4", "42", "A, C"
  // Raw answer for detailed views
  rawAnswer: z.any(),
  isCorrect: z.boolean().nullable(), // null for POLL type
  score: z.number(),
  maxScore: z.number().optional(),
  answeredAt: z.number(), // timestamp
  // For MC questions: which option(s) were selected
  selectedOptionIds: z.array(z.string()).optional(),
  // For ORDER questions: the order they submitted
  submittedOrder: z.array(z.string()).optional(),
  // For OPEN_TEXT: auto scoring info (allows host to adjust)
  answerId: z.string().optional(), // Database ID for score adjustment
  autoScore: z.number().optional(), // Auto-calculated score
  autoScorePercentage: z.number().optional(), // Auto-calculated percentage (0-100)
  isManuallyAdjusted: z.boolean().optional(), // Host has adjusted
});

export type PlayerAnsweredEvent = z.infer<typeof playerAnsweredEventSchema>;

/**
 * Host adjusts a player's score for OPEN_TEXT questions
 * Allows manual override of fuzzy matching score
 */
export const adjustScoreCommandSchema = z.object({
  sessionCode: z.string(),
  answerId: z.string(),
  playerId: z.string(),
  itemId: z.string(),
  scorePercentage: z.number().min(0).max(100), // 0, 25, 50, 75, 100
});

export type AdjustScoreCommand = z.infer<typeof adjustScoreCommandSchema>;

/**
 * Score adjusted event (sent to player when host adjusts their score)
 */
export const scoreAdjustedEventSchema = z.object({
  itemId: z.string(),
  playerId: z.string(),
  previousScore: z.number(),
  newScore: z.number(),
  newScorePercentage: z.number(),
  adjustedBy: z.enum(["host", "system"]),
});

export type ScoreAdjustedEvent = z.infer<typeof scoreAdjustedEventSchema>;

/**
 * Leaderboard update
 */
export const leaderboardUpdateEventSchema = z.object({
  leaderboard: z.array(z.object({
    playerId: z.string(),
    playerName: z.string(),
    score: z.number(),
    rank: z.number(),
  })),
});

export type LeaderboardUpdateEvent = z.infer<typeof leaderboardUpdateEventSchema>;

/**
 * Game state update (for minigames)
 */
export const gameStateEventSchema = z.object({
  tick: z.number(),
  players: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    rotation: z.number().optional(),
    velocity: z.object({ x: z.number(), y: z.number() }).optional(),
    isAlive: z.boolean().default(true),
    score: z.number().default(0),
  })),
  swans: z.array(z.object({
    id: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    rotation: z.number().optional(),
    targetPlayerId: z.string().nullable(),
  })).optional(),
  timeRemaining: z.number(),
});

export type GameStateEvent = z.infer<typeof gameStateEventSchema>;

/**
 * Error event
 */
export const errorEventSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

export type ErrorEvent = z.infer<typeof errorEventSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse incoming command
 * Returns parsed data or throws error with details
 */
export function validateCommand<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  commandName: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid ${commandName}: ${errors}`);
  }
  return result.data;
}

/**
 * Create event payload with standard envelope
 */
export function createEventPayload<T extends object>(
  sessionCode: string,
  payload: T,
  stateVersion?: number
): T & { sessionCode: string; timestamp: number; stateVersion?: number } {
  return {
    sessionCode,
    timestamp: Date.now(),
    ...(stateVersion !== undefined && { stateVersion }),
    ...payload,
  };
}

// ============================================================================
// RATE LIMITING (for minigames)
// ============================================================================

const inputRateLimits = new Map<string, number[]>();
const MAX_INPUTS_PER_SECOND = 30;

/**
 * Check if player is within rate limit
 * Returns true if allowed, false if rate limited
 */
export function checkInputRateLimit(playerId: string): boolean {
  const now = Date.now();
  const recentInputs = inputRateLimits.get(playerId) || [];
  
  // Filter to last second
  const filtered = recentInputs.filter(t => now - t < 1000);
  
  if (filtered.length >= MAX_INPUTS_PER_SECOND) {
    return false;
  }
  
  filtered.push(now);
  inputRateLimits.set(playerId, filtered);
  return true;
}

/**
 * Clean up rate limit tracking for disconnected players
 */
export function clearInputRateLimit(playerId: string): void {
  inputRateLimits.delete(playerId);
}

// ============================================================================
// SWAN CHASE GAME EVENTS
// ============================================================================

/**
 * Host starts Swan Chase game
 */
export const startSwanChaseCommandSchema = z.object({
  sessionCode: z.string(),
  mode: z.enum(["CLASSIC", "ROUNDS"]).optional(),
  duration: z.number().int().min(60).max(300).optional(), // 1-5 minutes
  teamAssignments: z.array(z.object({
    playerId: z.string(),
    team: z.enum(["BLUE", "WHITE"]),
  })).optional(), // Auto-assign if not provided
});

export type StartSwanChaseCommand = z.infer<typeof startSwanChaseCommandSchema>;

/**
 * Player movement input for Swan Chase
 */
export const swanChaseInputCommandSchema = z.object({
  sessionCode: z.string(),
  playerId: z.string(),
  input: z.object({
    direction: z.object({
      x: z.number().min(-1).max(1),
      y: z.number().min(-1).max(1),
    }),
    sprint: z.boolean().optional(),
    dash: z.boolean().optional(),
  }),
  timestamp: z.number(),
});

export type SwanChaseInputCommand = z.infer<typeof swanChaseInputCommandSchema>;

/**
 * Game state update (server → all clients)
 */
export const swanChaseStateEventSchema = z.object({
  sessionCode: z.string(),
  players: z.array(z.object({
    id: z.string(),
    name: z.string(),
    team: z.enum(["BLUE", "WHITE"]),
    type: z.enum(["BOAT", "SWAN"]),
    position: z.object({ x: z.number(), y: z.number() }),
    velocity: z.object({ x: z.number(), y: z.number() }),
    rotation: z.number(),
    status: z.enum(["ACTIVE", "TAGGED", "SAFE", "HUNTING", "DASHING"]),
    score: z.number(),
    tagsCount: z.number().optional(),
  })),
  timeRemaining: z.number(),
  winner: z.enum(["BLUE", "WHITE", "DRAW"]).nullable(),
});

export type SwanChaseStateEvent = z.infer<typeof swanChaseStateEventSchema>;

/**
 * Boat tagged event
 */
export const boatTaggedEventSchema = z.object({
  sessionCode: z.string(),
  boatId: z.string(),
  boatName: z.string(),
  swanId: z.string(),
  swanName: z.string(),
  timestamp: z.number(),
});

export type BoatTaggedEvent = z.infer<typeof boatTaggedEventSchema>;

/**
 * Boat reached safe zone event
 */
export const boatSafeEventSchema = z.object({
  sessionCode: z.string(),
  boatId: z.string(),
  boatName: z.string(),
  timeRemaining: z.number(),
});

export type BoatSafeEvent = z.infer<typeof boatSafeEventSchema>;

/**
 * Game ended event with results
 */
export const swanChaseEndedEventSchema = z.object({
  sessionCode: z.string(),
  winner: z.enum(["BLUE", "WHITE", "DRAW"]),
  finalScores: z.array(z.object({
    playerId: z.string(),
    playerName: z.string(),
    team: z.enum(["BLUE", "WHITE"]),
    score: z.number(),
    status: z.string(),
  })),
  stats: z.object({
    duration: z.number(),
    totalTags: z.number(),
    boatsInSafeZone: z.number(),
  }),
});

export type SwanChaseEndedEvent = z.infer<typeof swanChaseEndedEventSchema>;

