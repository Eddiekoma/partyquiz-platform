-- Session Persistence & Player Access Tokens
-- This migration adds:
-- 1. Session progress tracking (currentRoundIndex, currentItemIndex)
-- 2. Session pause state (pausedAt)
-- 3. Permanent player access tokens (accessToken)
-- 4. Player activity tracking (lastActiveAt)

-- Add progress tracking to LiveSession
ALTER TABLE "LiveSession" ADD COLUMN "currentRoundIndex" INTEGER;
ALTER TABLE "LiveSession" ADD COLUMN "currentItemIndex" INTEGER;
ALTER TABLE "LiveSession" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "LiveSession" ADD COLUMN "displayName" TEXT;

-- Add permanent access token to LivePlayer
ALTER TABLE "LivePlayer" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "LivePlayer" ADD COLUMN "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Generate unique access tokens for existing players
UPDATE "LivePlayer" SET "accessToken" = gen_random_uuid()::text WHERE "accessToken" IS NULL;

-- Make accessToken required and unique
ALTER TABLE "LivePlayer" ALTER COLUMN "accessToken" SET NOT NULL;
ALTER TABLE "LivePlayer" ADD CONSTRAINT "LivePlayer_accessToken_key" UNIQUE ("accessToken");

-- Index for fast token lookups
CREATE INDEX "LivePlayer_accessToken_idx" ON "LivePlayer"("accessToken");
