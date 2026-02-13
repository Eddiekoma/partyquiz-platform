// Enums and constants
export enum WorkspaceRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  VIEWER = "VIEWER",
}

/**
 * Question Types - The definitive list of all question types
 * 
 * These are the 24 types supported by the question editor.
 * Organized by category for clarity.
 * 
 * TEXT QUESTIONS (7):
 * - MC_SINGLE: Multiple choice with one correct answer
 * - MC_MULTIPLE: Multiple choice with multiple correct answers
 * - MC_ORDER: Put items in correct order
 * - OPEN_TEXT: Free text answer (fuzzy matching)
 * - NUMERIC: Numeric answer (distance-based scoring)
 * - SLIDER: Slider answer (distance-based scoring)
 * - TRUE_FALSE: True or false question
 * 
 * PHOTO QUESTIONS (7):
 * - PHOTO_MC_SINGLE: Multiple choice with photo(s)
 * - PHOTO_MC_MULTIPLE: Multiple choice with photo(s)
 * - PHOTO_MC_ORDER: Order items with photo(s)
 * - PHOTO_OPEN_TEXT: Open text with photo(s)
 * - PHOTO_NUMERIC: Numeric answer with photo(s)
 * - PHOTO_SLIDER: Slider answer with photo(s)
 * - PHOTO_TRUE_FALSE: True/false with photo(s)
 * 
 * AUDIO QUESTIONS (2):
 * - AUDIO_QUESTION: MCQ with audio
 * - AUDIO_OPEN: Open text with audio
 * 
 * VIDEO QUESTIONS (2):
 * - VIDEO_QUESTION: MCQ with video
 * - VIDEO_OPEN: Open text with video
 * 
 * SPOTIFY MUSIC (3):
 * - MUSIC_GUESS_TITLE: Guess song title
 * - MUSIC_GUESS_ARTIST: Guess artist name
 * - MUSIC_GUESS_YEAR: Guess release year
 * 
 * YOUTUBE VIDEOS (3):
 * - YOUTUBE_SCENE_QUESTION: Question about a scene
 * - YOUTUBE_NEXT_LINE: Guess the next line
 * - YOUTUBE_WHO_SAID_IT: Identify who said it
 */
export enum QuestionType {
  // === TEXT QUESTIONS (7) ===
  MC_SINGLE = "MC_SINGLE",
  MC_MULTIPLE = "MC_MULTIPLE",
  MC_ORDER = "MC_ORDER",
  OPEN_TEXT = "OPEN_TEXT",
  NUMERIC = "NUMERIC",
  SLIDER = "SLIDER",
  TRUE_FALSE = "TRUE_FALSE",

  // === PHOTO QUESTIONS (7) ===
  PHOTO_MC_SINGLE = "PHOTO_MC_SINGLE",
  PHOTO_MC_MULTIPLE = "PHOTO_MC_MULTIPLE",
  PHOTO_MC_ORDER = "PHOTO_MC_ORDER",
  PHOTO_OPEN_TEXT = "PHOTO_OPEN_TEXT",
  PHOTO_NUMERIC = "PHOTO_NUMERIC",
  PHOTO_SLIDER = "PHOTO_SLIDER",
  PHOTO_TRUE_FALSE = "PHOTO_TRUE_FALSE",

  // === AUDIO QUESTIONS (2) ===
  AUDIO_QUESTION = "AUDIO_QUESTION",
  AUDIO_OPEN = "AUDIO_OPEN",

  // === VIDEO QUESTIONS (2) ===
  VIDEO_QUESTION = "VIDEO_QUESTION",
  VIDEO_OPEN = "VIDEO_OPEN",

  // === SPOTIFY MUSIC (3) ===
  MUSIC_GUESS_TITLE = "MUSIC_GUESS_TITLE",
  MUSIC_GUESS_ARTIST = "MUSIC_GUESS_ARTIST",
  MUSIC_GUESS_YEAR = "MUSIC_GUESS_YEAR",

  // === YOUTUBE VIDEOS (3) ===
  YOUTUBE_SCENE_QUESTION = "YOUTUBE_SCENE_QUESTION",
  YOUTUBE_NEXT_LINE = "YOUTUBE_NEXT_LINE",
  YOUTUBE_WHO_SAID_IT = "YOUTUBE_WHO_SAID_IT",
}

/**
 * Legacy type mappings for backwards compatibility
 * Database has been migrated, these are for old client code only
 */
export const LEGACY_TYPE_MAPPING = {
  ORDER: QuestionType.MC_ORDER,
  ESTIMATION: QuestionType.NUMERIC,
  POLL: QuestionType.MC_SINGLE,
  PHOTO_QUESTION: QuestionType.PHOTO_MC_SINGLE,
  PHOTO_OPEN: QuestionType.PHOTO_OPEN_TEXT,
} as const;

/**
 * Helper to normalize legacy types to modern equivalents
 */
export function normalizeQuestionType(type: string): QuestionType {
  // @ts-ignore - Check if it's a legacy type
  return LEGACY_TYPE_MAPPING[type] || (type as QuestionType);
}

/**
 * Default timer durations per question type (in seconds)
 * These are tuned for optimal gameplay based on question complexity
 * Photo questions get +5 seconds bonus for viewing images
 */
export const DEFAULT_TIMER_BY_QUESTION_TYPE: Record<QuestionType, number> = {
  // Text questions
  [QuestionType.MC_SINGLE]: 15,              // Read + think about 4 options
  [QuestionType.MC_MULTIPLE]: 20,            // More options to consider
  [QuestionType.MC_ORDER]: 45,               // Multiple items to arrange
  [QuestionType.OPEN_TEXT]: 30,              // Typing takes time
  [QuestionType.NUMERIC]: 20,                // Think about the number
  [QuestionType.SLIDER]: 15,                 // Quick slider adjustment
  [QuestionType.TRUE_FALSE]: 10,             // Simple yes/no decision

  // Photo questions (+5 seconds for viewing photos)
  [QuestionType.PHOTO_MC_SINGLE]: 20,        // View photo(s) + think
  [QuestionType.PHOTO_MC_MULTIPLE]: 25,      // View photo(s) + multiple options
  [QuestionType.PHOTO_MC_ORDER]: 50,         // View photo(s) + arrange
  [QuestionType.PHOTO_OPEN_TEXT]: 35,        // View photo(s) + type
  [QuestionType.PHOTO_NUMERIC]: 25,          // View photo(s) + count/estimate
  [QuestionType.PHOTO_SLIDER]: 20,           // View photo(s) + slider
  [QuestionType.PHOTO_TRUE_FALSE]: 15,       // View photo(s) + yes/no

  // Audio questions
  [QuestionType.AUDIO_QUESTION]: 25,         // Listen + choose
  [QuestionType.AUDIO_OPEN]: 35,             // Listen + type

  // Video questions
  [QuestionType.VIDEO_QUESTION]: 30,         // Watch video + choose
  [QuestionType.VIDEO_OPEN]: 40,             // Watch video + type

  // Spotify music questions
  [QuestionType.MUSIC_GUESS_TITLE]: 20,      // Listen + recognize
  [QuestionType.MUSIC_GUESS_ARTIST]: 20,     // Listen + recognize
  [QuestionType.MUSIC_GUESS_YEAR]: 25,       // Harder - guess the year

  // YouTube video questions
  [QuestionType.YOUTUBE_SCENE_QUESTION]: 25, // Watch video + answer
  [QuestionType.YOUTUBE_NEXT_LINE]: 20,      // Quote recognition
  [QuestionType.YOUTUBE_WHO_SAID_IT]: 20,    // Voice recognition
};

/**
 * Get the default timer duration for a question type
 * Handles legacy types by normalizing them first
 * @param questionType The type of question
 * @returns Timer duration in seconds (defaults to 15 if type unknown)
 */
export function getDefaultTimerForQuestionType(questionType: string): number {
  const normalized = normalizeQuestionType(questionType);
  return DEFAULT_TIMER_BY_QUESTION_TYPE[normalized] ?? 15;
}

export enum MediaType {
  IMAGE = "IMAGE",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
}

/**
 * Get the base question type by stripping media prefixes
 * This allows reusing logic across text and media variants
 * 
 * @example
 * getBaseQuestionType('PHOTO_MC_SINGLE') // returns 'MC_SINGLE'
 * getBaseQuestionType('AUDIO_QUESTION') // returns 'MC_SINGLE'
 * getBaseQuestionType('MC_SINGLE') // returns 'MC_SINGLE'
 */
export function getBaseQuestionType(type: QuestionType): QuestionType {
  const typeStr = type.toString();
  
  // === LEGACY TYPE MAPPINGS (backwards compatibility) ===
  // Map old types to new equivalents
  if (typeStr === 'ORDER') return QuestionType.MC_ORDER;
  if (typeStr === 'ESTIMATION') return QuestionType.NUMERIC;
  if (typeStr === 'POLL') return QuestionType.MC_SINGLE;
  if (typeStr === 'PHOTO_QUESTION') return QuestionType.PHOTO_MC_SINGLE;
  if (typeStr === 'PHOTO_OPEN') return QuestionType.PHOTO_OPEN_TEXT;
  
  // Strip PHOTO_ prefix
  if (typeStr.startsWith('PHOTO_')) {
    return typeStr.replace('PHOTO_', '') as QuestionType;
  }
  
  // Strip AUDIO_ prefix (legacy mapping)
  if (typeStr === 'AUDIO_QUESTION') return QuestionType.MC_SINGLE;
  if (typeStr === 'AUDIO_OPEN') return QuestionType.OPEN_TEXT;
  
  // Strip VIDEO_ prefix (legacy mapping)
  if (typeStr === 'VIDEO_QUESTION') return QuestionType.MC_SINGLE;
  if (typeStr === 'VIDEO_OPEN') return QuestionType.OPEN_TEXT;
  
  // Already a base type
  return type;
}

/**
 * Check if a question type requires photo media
 */
export function requiresPhotos(type: QuestionType): boolean {
  return type.toString().startsWith('PHOTO_');
}

/**
 * Get maximum allowed photos for a question type
 */
export function getMaxPhotos(type: QuestionType): number {
  return requiresPhotos(type) ? 6 : 0;
}

/**
 * Get the media type required for a question type
 */
export function getRequiredMediaType(type: QuestionType): MediaType | null {
  const typeStr = type.toString();
  if (typeStr.startsWith('PHOTO_')) return MediaType.IMAGE;
  if (typeStr.startsWith('AUDIO_')) return MediaType.AUDIO;
  if (typeStr.startsWith('VIDEO_')) return MediaType.VIDEO;
  return null;
}

/**
 * Aspect ratio categories for smart image layout
 */
export enum AspectRatioCategory {
  ULTRA_WIDE = 'ULTRA_WIDE',  // > 2.5:1 (e.g. 21:9 cinema)
  WIDE = 'WIDE',              // 1.7:1 to 2.5:1 (e.g. 16:9)
  STANDARD = 'STANDARD',      // 1.2:1 to 1.7:1 (e.g. 4:3, 3:2)
  SQUARE = 'SQUARE',          // 0.9:1 to 1.2:1 (almost square)
  PORTRAIT = 'PORTRAIT',      // 0.6:1 to 0.9:1 (e.g. 9:16)
  TALL = 'TALL',              // < 0.6:1 (very tall)
}

/**
 * Determine aspect ratio category from dimensions
 * Used for smart photo grid layouts
 * 
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns AspectRatioCategory enum value
 */
export function getAspectRatioCategory(width: number, height: number): AspectRatioCategory {
  const ratio = width / height;
  
  if (ratio > 2.5) return AspectRatioCategory.ULTRA_WIDE;
  if (ratio > 1.7) return AspectRatioCategory.WIDE;
  if (ratio > 1.2) return AspectRatioCategory.STANDARD;
  if (ratio > 0.9) return AspectRatioCategory.SQUARE;
  if (ratio > 0.6) return AspectRatioCategory.PORTRAIT;
  return AspectRatioCategory.TALL;
}

export enum MediaProvider {
  UPLOAD = "UPLOAD",
  SPOTIFY = "SPOTIFY",
  YOUTUBE = "YOUTUBE",
}

export enum QuestionStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum QuizItemType {
  QUESTION = "QUESTION",
  MINIGAME = "MINIGAME",
  BREAK = "BREAK",
}

export enum MinigameType {
  SWAN_RACE = "SWAN_RACE",
}

export enum SessionStatus {
  LOBBY = "LOBBY",
  ITEM_INTRO = "ITEM_INTRO",
  ITEM_ACTIVE = "ITEM_ACTIVE",
  ITEM_LOCKED = "ITEM_LOCKED",
  REVEAL = "REVEAL",
  LEADERBOARD = "LEADERBOARD",
  ENDED = "ENDED",
}

export enum AssetType {
  IMAGE = "IMAGE",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
  OTHER = "OTHER",
}

// Type definitions
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  brandingJson: Record<string, any> | null;
  createdAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
}

export interface Question {
  id: string;
  workspaceId: string;
  type: QuestionType;
  title: string;
  prompt: string;
  explanation: string | null;
  difficulty: number;
  tagsJson: string[];
  status: QuestionStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionMedia {
  id: string;
  questionId: string;
  provider: MediaProvider;
  mediaType: MediaType;
  reference: Record<string, any>; // Flexible JSON
  metadata: Record<string, any> | null;
  order: number;
}

export interface SpotifyReference {
  trackId: string;
  startMs?: number;
  durationMs?: number;
}

export interface YouTubeReference {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface UploadReference {
  assetId: string;
}

// WebSocket message types
export enum WSMessageType {
  // Client -> Server (Player actions)
  JOIN_SESSION = "JOIN_SESSION",
  PLAYER_REJOIN = "PLAYER_REJOIN",
  REJOIN_AS_EXISTING = "REJOIN_AS_EXISTING", // Rejoin as recognized device's player
  JOIN_AS_NEW = "JOIN_AS_NEW", // Join as new player despite device being recognized
  SUBMIT_ANSWER = "SUBMIT_ANSWER",
  GAME_INPUT = "GAME_INPUT",

  // Client -> Server (Host actions)
  HOST_JOIN_SESSION = "HOST_JOIN_SESSION",
  REQUEST_SYNC = "REQUEST_SYNC", // Host requests current player list (lightweight sync)
  START_ITEM = "START_ITEM",
  LOCK_ITEM = "LOCK_ITEM",
  CANCEL_ITEM = "CANCEL_ITEM", // Cancel current item without scoring/revealing
  REVEAL_ANSWERS = "REVEAL_ANSWERS",
  END_SESSION = "END_SESSION",
  RESET_SESSION = "RESET_SESSION",
  START_SWAN_RACE = "START_SWAN_RACE",
  PAUSE_SESSION = "PAUSE_SESSION",
  RESUME_SESSION = "RESUME_SESSION",
  KICK_PLAYER = "KICK_PLAYER",
  
  // Swan Chase game
  START_SWAN_CHASE = "START_SWAN_CHASE",
  SWAN_CHASE_INPUT = "SWAN_CHASE_INPUT",
  BOAT_MOVE = "BOAT_MOVE",
  BOAT_SPRINT = "BOAT_SPRINT",
  SWAN_MOVE = "SWAN_MOVE",
  SWAN_DASH = "SWAN_DASH",
  END_SWAN_CHASE = "END_SWAN_CHASE",

  // Server -> Client (State updates)
  SESSION_STATE = "SESSION_STATE",
  PLAYER_JOINED = "PLAYER_JOINED",
  PLAYER_LEFT = "PLAYER_LEFT",
  PLAYER_KICKED = "PLAYER_KICKED",
  ITEM_STARTED = "ITEM_STARTED",
  ITEM_LOCKED = "ITEM_LOCKED",
  ITEM_CANCELLED = "ITEM_CANCELLED", // Item was cancelled
  REVEAL = "REVEAL",
  LEADERBOARD_UPDATE = "LEADERBOARD_UPDATE",
  GAME_STATE = "GAME_STATE",
  SWAN_RACE_STARTED = "SWAN_RACE_STARTED",
  SESSION_PAUSED = "SESSION_PAUSED",
  SESSION_RESUMED = "SESSION_RESUMED",
  POLL_RESULTS = "POLL_RESULTS",
  SPEED_PODIUM_RESULTS = "SPEED_PODIUM_RESULTS", // Top 3 fastest 100% correct players
  
  // Swan Chase game events
  SWAN_CHASE_STARTED = "SWAN_CHASE_STARTED",
  SWAN_CHASE_STATE = "SWAN_CHASE_STATE",
  BOAT_TAGGED = "BOAT_TAGGED",
  BOAT_SAFE = "BOAT_SAFE",
  SWAN_CHASE_ENDED = "SWAN_CHASE_ENDED",
  
  // Server -> Client (Acknowledgements)
  ANSWER_RECEIVED = "ANSWER_RECEIVED",
  ANSWER_COUNT_UPDATED = "ANSWER_COUNT_UPDATED",
  PLAYER_ANSWERED = "PLAYER_ANSWERED", // Detailed answer info sent to host
  SESSION_ENDED = "SESSION_ENDED",
  SESSION_RESET = "SESSION_RESET",
  DEVICE_RECOGNIZED = "DEVICE_RECOGNIZED", // Device already has a player in this session
  GENERATE_REJOIN_TOKEN = "GENERATE_REJOIN_TOKEN", // Host requests rejoin token for player
  REJOIN_TOKEN_GENERATED = "REJOIN_TOKEN_GENERATED", // Server responds with token
  
  // Score adjustment (OPEN_TEXT manual scoring)
  ADJUST_SCORE = "ADJUST_SCORE", // Host -> Server: adjust OPEN_TEXT answer score
  SCORE_ADJUSTED = "SCORE_ADJUSTED", // Server -> Client: score was adjusted
  
  // Error
  ERROR = "ERROR",
}

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: number;
}

export interface PlayerInput {
  direction: { x: number; y: number }; // normalized
  throttle: number; // 0-1
}

export interface GameState {
  tick: number;
  players: Array<{
    id: string;
    position: { x: number; y: number };
    rotation: number;
    velocity: { x: number; y: number };
    isAlive: boolean;
    score: number;
  }>;
  swans: Array<{
    id: string;
    position: { x: number; y: number };
    rotation: number;
    targetPlayerId: string | null;
  }>;
  powerUps: Array<{
    id: string;
    type: "FISH_LURE" | "TURBO" | "SHIELD";
    position: { x: number; y: number };
  }>;
  timeRemaining: number;
}

// ============================================================================
// SWAN CHASE GAME TYPES (New game mode)
// ============================================================================

/**
 * Swan Chase game modes
 */
export enum SwanChaseMode {
  CLASSIC = "CLASSIC",        // Single round: Boats vs Swans
  ROUNDS = "ROUNDS",          // 2 rounds with team swap
  TEAM_ESCAPE = "TEAM_ESCAPE", // Legacy: same as CLASSIC
  KING_OF_LAKE = "KING_OF_LAKE",      // Free-for-all (future)
  SWAN_SWARM = "SWAN_SWARM",          // Co-op survival (future)
}

/**
 * Player status in Swan Chase
 */
export enum SwanChasePlayerStatus {
  // Boat statuses
  ACTIVE = "ACTIVE",      // Can move, can be tagged
  TAGGED = "TAGGED",      // Frozen, out of game
  SAFE = "SAFE",          // In safe zone, can't be tagged
  
  // Swan statuses
  HUNTING = "HUNTING",    // Normal chase mode
  DASHING = "DASHING",    // Speed boost active
}

/**
 * Team types
 */
export enum SwanChaseTeam {
  BLUE = "BLUE",    // Boats team
  WHITE = "WHITE",  // Swans team
}

/**
 * Position in 2D space
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Player state in Swan Chase game
 */
export interface SwanChasePlayer {
  id: string;
  name: string;
  avatar?: string | null;
  team: SwanChaseTeam;
  type: 'BOAT' | 'SWAN';
  position: Vector2D;
  velocity: Vector2D;
  rotation: number; // 0-360 degrees
  status: SwanChasePlayerStatus;
  
  // Stats
  score: number;
  tagsCount?: number; // For swans
  
  // Abilities
  abilities: {
    sprint: {
      charges: number;
      active: boolean;
      cooldownUntil: number; // timestamp
    };
    dash?: {
      charges: number;
      active: boolean;
      cooldownUntil: number;
    };
  };
}

/**
 * Safe zone configuration
 */
export interface SafeZone {
  position: Vector2D;
  radius: number;
}

/**
 * Obstacle in game area
 */
export interface Obstacle {
  id: string;
  type: 'ISLAND' | 'ROCK';
  position: Vector2D;
  radius: number;
}

/**
 * Game settings based on player count
 */
export interface SwanChaseSettings {
  totalPlayers: number;
  boatsCount: number;
  swansCount: number;
  duration: number; // seconds
  gameArea: {
    width: number;
    height: number;
  };
  safeZone: SafeZone;
  speeds: {
    boat: number; // px/sec
    boatSprint: number;
    swan: number;
    swanDash: number;
  };
  tagRange: number; // collision distance
  obstacles: Obstacle[];
}

/**
 * Complete game state for Swan Chase
 */
export interface SwanChaseGameState {
  mode: SwanChaseMode;
  sessionCode: string;
  round: 1 | 2;
  status: 'COUNTDOWN' | 'ACTIVE' | 'ENDED';
  startTime: number;
  timeRemaining: number;
  settings: SwanChaseSettings;
  
  players: SwanChasePlayer[];
  
  // Win tracking
  winner: SwanChaseTeam | 'DRAW' | null;
  winConditionMet: boolean;
}
