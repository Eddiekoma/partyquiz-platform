# Question Type Enum Migration Plan

## Huidige Situatie
- Database: `type String` (geen enum)
- TypeScript: `enum QuestionType` in shared package
- Probleem: Inconsistente types in code (ORDER vs MC_ORDER, ESTIMATION vs NUMERIC)

## Doelstelling
Database enum gebruiken voor type safety en consistentie

## Stappen

### 1. Database Enum Aanmaken
```sql
-- Create PostgreSQL enum type
CREATE TYPE "QuestionType" AS ENUM (
  -- TEXT QUESTIONS (7)
  'MC_SINGLE',
  'MC_MULTIPLE', 
  'MC_ORDER',
  'TRUE_FALSE',
  'OPEN_TEXT',
  'NUMERIC',
  'SLIDER',
  
  -- PHOTO QUESTIONS (7)
  'PHOTO_MC_SINGLE',
  'PHOTO_MC_MULTIPLE',
  'PHOTO_MC_ORDER',
  'PHOTO_TRUE_FALSE',
  'PHOTO_OPEN_TEXT',
  'PHOTO_NUMERIC',
  'PHOTO_SLIDER',
  
  -- AUDIO QUESTIONS (2)
  'AUDIO_QUESTION',
  'AUDIO_OPEN',
  
  -- VIDEO QUESTIONS (2)
  'VIDEO_QUESTION',
  'VIDEO_OPEN',
  
  -- SPOTIFY MUSIC (3)
  'MUSIC_GUESS_TITLE',
  'MUSIC_GUESS_ARTIST',
  'MUSIC_GUESS_YEAR',
  
  -- YOUTUBE VIDEOS (3)
  'YOUTUBE_SCENE_QUESTION',
  'YOUTUBE_NEXT_LINE',
  'YOUTUBE_WHO_SAID_IT'
);
```

### 2. Migreer Bestaande Data
```sql
-- Convert legacy types to modern equivalents
UPDATE "Question" 
SET type = 'MC_ORDER' 
WHERE type = 'ORDER';

UPDATE "Question" 
SET type = 'NUMERIC' 
WHERE type = 'ESTIMATION';

UPDATE "Question" 
SET type = 'MC_SINGLE' 
WHERE type = 'POLL';

UPDATE "Question" 
SET type = 'PHOTO_OPEN_TEXT' 
WHERE type = 'PHOTO_OPEN';

UPDATE "Question" 
SET type = 'PHOTO_MC_SINGLE' 
WHERE type = 'PHOTO_QUESTION';

-- Delete any remaining invalid types (if any)
-- CHECK FIRST: SELECT DISTINCT type FROM "Question" WHERE type NOT IN (enum values);
```

### 3. Verander Column Type
```sql
-- Change column from String to Enum
ALTER TABLE "Question" 
ALTER COLUMN type TYPE "QuestionType" 
USING type::"QuestionType";
```

### 4. Update Prisma Schema
```prisma
enum QuestionType {
  // TEXT QUESTIONS
  MC_SINGLE
  MC_MULTIPLE
  MC_ORDER
  TRUE_FALSE
  OPEN_TEXT
  NUMERIC
  SLIDER
  
  // PHOTO QUESTIONS
  PHOTO_MC_SINGLE
  PHOTO_MC_MULTIPLE
  PHOTO_MC_ORDER
  PHOTO_TRUE_FALSE
  PHOTO_OPEN_TEXT
  PHOTO_NUMERIC
  PHOTO_SLIDER
  
  // AUDIO
  AUDIO_QUESTION
  AUDIO_OPEN
  
  // VIDEO
  VIDEO_QUESTION
  VIDEO_OPEN
  
  // SPOTIFY
  MUSIC_GUESS_TITLE
  MUSIC_GUESS_ARTIST
  MUSIC_GUESS_YEAR
  
  // YOUTUBE
  YOUTUBE_SCENE_QUESTION
  YOUTUBE_NEXT_LINE
  YOUTUBE_WHO_SAID_IT
}

model Question {
  // ...
  type QuestionType // Changed from String
  // ...
}
```

### 5. Update TypeScript Code
- API routes: Verwijder z.enum, gebruik gewoon QuestionType import
- Frontend: Gebruik QuestionType enum overal
- WebSocket: Update type checks

### 6. Backwards Compatibility
Legacy types worden NIET meer ondersteund in database:
- `ORDER` → `MC_ORDER`
- `ESTIMATION` → `NUMERIC` 
- `POLL` → `MC_SINGLE`
- `PHOTO_OPEN` → `PHOTO_OPEN_TEXT`
- `PHOTO_QUESTION` → `PHOTO_MC_SINGLE`

TypeScript enum kan legacy types behouden voor oude code, maar database accepteert ze niet meer.

## Voordelen
✅ Type safety op database niveau
✅ Geen ongeldige types mogelijk
✅ Database enforced constraints
✅ Betere performance (enum vs string)
✅ Auto-completion in database tools
✅ Dwingt code consistency af

## Risico's
⚠️ Breaking change voor bestaande data
⚠️ Migration moet grondig getest worden
⚠️ Alle legacy types moeten correct gemigreerd

## Testing
1. Backup database VOOR migration
2. Test migration op lokale copy
3. Verificeer alle questions na migration
4. Test create/update operations
5. Test WebSocket scoring logic
