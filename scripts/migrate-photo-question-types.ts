/**
 * Migration Script: PHOTO_QUESTION and PHOTO_OPEN to new types
 * 
 * This script migrates old photo question types to new unified system:
 * - PHOTO_QUESTION → PHOTO_MC_SINGLE
 * - PHOTO_OPEN → PHOTO_OPEN_TEXT
 * 
 * Run from apps/web: npx tsx ../../scripts/migrate-photo-question-types.ts
 * Or use direct SQL in database
 */

// This file documents the SQL migration - run directly in database
const migrationSQL = `
-- Step 1: Backup check - count existing photo questions
SELECT 
  type, 
  COUNT(*) as count
FROM "Question"
WHERE type IN ('PHOTO_QUESTION', 'PHOTO_OPEN')
GROUP BY type;

-- Step 2: Migrate PHOTO_QUESTION to PHOTO_MC_SINGLE
UPDATE "Question"
SET type = 'PHOTO_MC_SINGLE'
WHERE type = 'PHOTO_QUESTION';

-- Step 3: Migrate PHOTO_OPEN to PHOTO_OPEN_TEXT
UPDATE "Question"
SET type = 'PHOTO_OPEN_TEXT'
WHERE type = 'PHOTO_OPEN';

-- Step 4: Verify migration
SELECT 
  type, 
  COUNT(*) as count
FROM "Question"
WHERE type IN ('PHOTO_MC_SINGLE', 'PHOTO_OPEN_TEXT', 'PHOTO_QUESTION', 'PHOTO_OPEN')
GROUP BY type;

-- Step 5: Set displayOrder to 0 for any NULL values (shouldn't be needed with default)
UPDATE "QuestionMedia"
SET "displayOrder" = 0
WHERE "displayOrder" IS NULL;

-- Step 6: Verify all QuestionMedia have displayOrder
SELECT 
  COUNT(*) as total,
  COUNT("displayOrder") as with_display_order
FROM "QuestionMedia";
`;

console.log('Photo Question Type Migration SQL:');
console.log('='.repeat(60));
console.log(migrationSQL);
console.log('='.repeat(60));
console.log('\nTo run migration:');
console.log('1. Connect to your database');
console.log('2. Copy and paste the SQL above');
console.log('3. Verify results');

export { migrationSQL };
