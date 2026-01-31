// Enums and constants
export enum WorkspaceRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  VIEWER = "VIEWER",
}

export enum QuestionType {
  // Standard
  MCQ = "MCQ",
  TRUE_FALSE = "TRUE_FALSE",
  OPEN = "OPEN",
  ORDERING = "ORDERING",

  // Photo-based
  PHOTO_GUESS = "PHOTO_GUESS",
  PHOTO_ZOOM_REVEAL = "PHOTO_ZOOM_REVEAL",
  PHOTO_TIMELINE = "PHOTO_TIMELINE",

  // Music-based (Spotify)
  MUSIC_GUESS_TITLE = "MUSIC_GUESS_TITLE",
  MUSIC_GUESS_ARTIST = "MUSIC_GUESS_ARTIST",
  MUSIC_GUESS_YEAR = "MUSIC_GUESS_YEAR",
  MUSIC_HITSTER_TIMELINE = "MUSIC_HITSTER_TIMELINE",
  MUSIC_OLDER_NEWER_THAN = "MUSIC_OLDER_NEWER_THAN",

  // Video-based (YouTube)
  YOUTUBE_SCENE_QUESTION = "YOUTUBE_SCENE_QUESTION",
  YOUTUBE_NEXT_LINE = "YOUTUBE_NEXT_LINE",
  YOUTUBE_WHO_SAID_IT = "YOUTUBE_WHO_SAID_IT",

  // Social/Party
  POLL = "POLL",
  EMOJI_VOTE = "EMOJI_VOTE",
  CHAOS_EVENT = "CHAOS_EVENT",
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
  SUBMIT_ANSWER = "SUBMIT_ANSWER",
  GAME_INPUT = "GAME_INPUT",

  // Client -> Server (Host actions)
  START_ITEM = "START_ITEM",
  LOCK_ITEM = "LOCK_ITEM",
  REVEAL_ANSWERS = "REVEAL_ANSWERS",
  END_SESSION = "END_SESSION",
  START_SWAN_RACE = "START_SWAN_RACE",

  // Server -> Client (State updates)
  SESSION_STATE = "SESSION_STATE",
  PLAYER_JOINED = "PLAYER_JOINED",
  PLAYER_LEFT = "PLAYER_LEFT",
  ITEM_STARTED = "ITEM_STARTED",
  ITEM_LOCKED = "ITEM_LOCKED",
  REVEAL = "REVEAL",
  LEADERBOARD_UPDATE = "LEADERBOARD_UPDATE",
  GAME_STATE = "GAME_STATE",
  SWAN_RACE_STARTED = "SWAN_RACE_STARTED",
  
  // Server -> Client (Acknowledgements)
  ANSWER_RECEIVED = "ANSWER_RECEIVED",
  ANSWER_COUNT_UPDATED = "ANSWER_COUNT_UPDATED",
  SESSION_ENDED = "SESSION_ENDED",
  
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
