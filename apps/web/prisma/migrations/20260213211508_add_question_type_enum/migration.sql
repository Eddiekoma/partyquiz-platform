/*
  Migration: Add QuestionType enum and migrate legacy types
  
  This migration:
  1. Creates PostgreSQL enum with 24 official question types
  2. Migrates legacy types to modern equivalents:
     - ORDER → MC_ORDER
     - ESTIMATION → NUMERIC
     - POLL → MC_SINGLE
     - PHOTO_OPEN → PHOTO_OPEN_TEXT
     - PHOTO_QUESTION → PHOTO_MC_SINGLE
     - MUSIC_INTRO → MUSIC_GUESS_TITLE (if exists)
     - MUSIC_SNIPPET → MUSIC_GUESS_TITLE (if exists)
  3. Converts type column from String to Enum
*/

-- Step 1: Create the QuestionType enum
CREATE TYPE "QuestionType" AS ENUM (
  'MC_SINGLE', 'MC_MULTIPLE', 'MC_ORDER', 'TRUE_FALSE', 'OPEN_TEXT', 'NUMERIC', 'SLIDER',
  'PHOTO_MC_SINGLE', 'PHOTO_MC_MULTIPLE', 'PHOTO_MC_ORDER', 'PHOTO_TRUE_FALSE', 'PHOTO_OPEN_TEXT', 'PHOTO_NUMERIC', 'PHOTO_SLIDER',
  'AUDIO_QUESTION', 'AUDIO_OPEN',
  'VIDEO_QUESTION', 'VIDEO_OPEN',
  'MUSIC_GUESS_TITLE', 'MUSIC_GUESS_ARTIST', 'MUSIC_GUESS_YEAR',
  'YOUTUBE_SCENE_QUESTION', 'YOUTUBE_NEXT_LINE', 'YOUTUBE_WHO_SAID_IT'
);

-- Step 2: Migrate legacy types to modern equivalents
-- This ensures all data is compatible with the new enum

-- Legacy text types
UPDATE "Question" SET type = 'MC_ORDER' WHERE type = 'ORDER';
UPDATE "Question" SET type = 'NUMERIC' WHERE type = 'ESTIMATION';
UPDATE "Question" SET type = 'MC_SINGLE' WHERE type = 'POLL';

-- Legacy photo types
UPDATE "Question" SET type = 'PHOTO_OPEN_TEXT' WHERE type = 'PHOTO_OPEN';
UPDATE "Question" SET type = 'PHOTO_MC_SINGLE' WHERE type = 'PHOTO_QUESTION';

-- Legacy music types (if they exist)
UPDATE "Question" SET type = 'MUSIC_GUESS_TITLE' WHERE type IN ('MUSIC_INTRO', 'MUSIC_SNIPPET');

-- Step 3: Add temporary column with new enum type
ALTER TABLE "Question" ADD COLUMN "type_new" "QuestionType";

-- Step 4: Copy data from old column to new column with type casting
UPDATE "Question" SET "type_new" = type::"QuestionType";

-- Step 5: Drop old column and rename new column
ALTER TABLE "Question" DROP COLUMN "type";
ALTER TABLE "Question" RENAME COLUMN "type_new" TO "type";

-- Step 6: Make the column NOT NULL (it already has data)
ALTER TABLE "Question" ALTER COLUMN "type" SET NOT NULL;

-- Step 7: Recreate index
CREATE INDEX "Question_type_idx" ON "Question"("type");
