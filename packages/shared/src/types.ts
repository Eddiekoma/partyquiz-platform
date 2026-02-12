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
 * These are the 19 types supported by the question editor.
 * Organized by category for clarity.
 * 
 * TEXT QUESTIONS (7):
 * - MC_SINGLE: Multiple choice with one correct answer
 * - MC_MULTIPLE: Multiple choice with multiple correct answers
 * - TRUE_FALSE: True or false question
 * - OPEN_TEXT: Free text answer (fuzzy matching)
 * - ESTIMATION: Guess a number (distance-based scoring)
 * - ORDER: Put items in correct order
 * - POLL: No correct answer, just opinions
 * 
 * PHOTO QUESTIONS (2):
 * - PHOTO_QUESTION: MCQ with photo
 * - PHOTO_OPEN: Open text with photo
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
  TRUE_FALSE = "TRUE_FALSE",
  OPEN_TEXT = "OPEN_TEXT",
  ESTIMATION = "ESTIMATION",
  ORDER = "ORDER",
  POLL = "POLL",

  // === PHOTO QUESTIONS (2) ===
  PHOTO_QUESTION = "PHOTO_QUESTION",
  PHOTO_OPEN = "PHOTO_OPEN",

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
 * Default timer durations per question type (in seconds)
 * These are tuned for optimal gameplay based on question complexity
 */
export const DEFAULT_TIMER_BY_QUESTION_TYPE: Record<QuestionType, number> = {
  // Text questions
  [QuestionType.MC_SINGLE]: 15,              // Read + think about 4 options
  [QuestionType.MC_MULTIPLE]: 20,            // More options to consider
  [QuestionType.TRUE_FALSE]: 10,             // Simple yes/no decision
  [QuestionType.OPEN_TEXT]: 30,              // Typing takes time
  [QuestionType.ESTIMATION]: 20,             // Think about the number
  [QuestionType.ORDER]: 45,                  // Multiple items to arrange
  [QuestionType.POLL]: 15,                   // No right/wrong, just choose

  // Photo questions
  [QuestionType.PHOTO_QUESTION]: 20,         // Look at photo + think
  [QuestionType.PHOTO_OPEN]: 30,             // Look at photo + type

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
 * @param questionType The type of question
 * @returns Timer duration in seconds (defaults to 15 if type unknown)
 */
export function getDefaultTimerForQuestionType(questionType: string): number {
  return DEFAULT_TIMER_BY_QUESTION_TYPE[questionType as QuestionType] ?? 15;
}

export enum MediaProvider {
  UPLOAD = "UPLOAD",
  SPOTIFY = "SPOTIFY",
  YOUTUBE = "YOUTUBE",
}

export enum MediaType {
  IMAGE = "IMAGE",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
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
  
  // Server -> Client (Acknowledgements)
  ANSWER_RECEIVED = "ANSWER_RECEIVED",
  ANSWER_COUNT_UPDATED = "ANSWER_COUNT_UPDATED",
  PLAYER_ANSWERED = "PLAYER_ANSWERED", // Detailed answer info sent to host
  SESSION_ENDED = "SESSION_ENDED",
  SESSION_RESET = "SESSION_RESET",
  DEVICE_RECOGNIZED = "DEVICE_RECOGNIZED", // Device already has a player in this session
  GENERATE_REJOIN_TOKEN = "GENERATE_REJOIN_TOKEN", // Host requests rejoin token for player
  REJOIN_TOKEN_GENERATED = "REJOIN_TOKEN_GENERATED", // Server responds with token
  
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
