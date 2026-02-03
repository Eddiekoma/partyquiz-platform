import { z } from "zod";
import { WorkspaceRole, QuestionType, MediaProvider, MediaType } from "./types";

// Environment validation
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32).optional(), // Made optional for build
  NEXTAUTH_URL: z.string().url(),
  APP_BASE_URL: z.string().url(),
  WS_BASE_URL: z.string().url(),

  // S3 (Hetzner Object Storage) - Optional for build, required for media features
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("eu-central"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // Spotify
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().optional(),

  // Email
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: z.string().optional(),
  EMAIL_SMTP_USER: z.string().optional(),
  EMAIL_SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(WorkspaceRole),
});

// Question schemas
export const createQuestionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(2000),
  explanation: z.string().max(1000).optional(),
  difficulty: z.number().int().min(1).max(5).default(3),
  tags: z.array(z.string()).default([]),
});

export const questionOptionSchema = z.object({
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
  order: z.number().int().min(0),
});

export const questionMediaSchema = z.object({
  provider: z.nativeEnum(MediaProvider),
  mediaType: z.nativeEnum(MediaType),
  reference: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  order: z.number().int().min(0),
});

// Upload schemas
export const uploadRequestSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB max
});

// Session schemas
export const joinSessionSchema = z.object({
  sessionCode: z.string().length(6).regex(/^[A-Z0-9]+$/),
  playerName: z.string().min(1).max(50),
  avatar: z.string().optional(),
});

export const submitAnswerSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(),
  quizItemId: z.string(),
  answer: z.any(), // Flexible based on question type
  answeredAt: z.number(),
});

// Game input schema
export const gameInputSchema = z.object({
  direction: z.object({
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  }),
  throttle: z.number().min(0).max(1),
});

// Spotify schemas
export const spotifyTrackSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const spotifyTrackReferenceSchema = z.object({
  trackId: z.string(),
  startMs: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(1000).max(60000).default(30000),
});

// YouTube schemas
export const youtubeReferenceSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  startSeconds: z.number().int().min(0).default(0),
  endSeconds: z.number().int().min(0).optional(),
});
