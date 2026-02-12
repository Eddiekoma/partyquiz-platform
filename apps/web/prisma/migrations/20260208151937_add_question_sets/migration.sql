-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "questionSetId" TEXT;

-- CreateTable
CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSet_workspaceId_idx" ON "QuestionSet"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSet_workspaceId_name_key" ON "QuestionSet"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Question_questionSetId_idx" ON "Question"("questionSetId");

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data Migration: Create "Uncategorized" set for each workspace that has questions
INSERT INTO "QuestionSet" ("id", "workspaceId", "name", "description", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    w."id",
    'Uncategorized',
    'Default set for questions without a specific category',
    NOW(),
    NOW()
FROM "Workspace" w
WHERE EXISTS (SELECT 1 FROM "Question" q WHERE q."workspaceId" = w."id");

-- Data Migration: Assign all existing questions to their workspace's "Uncategorized" set
UPDATE "Question" q
SET "questionSetId" = qs."id"
FROM "QuestionSet" qs
WHERE qs."workspaceId" = q."workspaceId" 
  AND qs."name" = 'Uncategorized'
  AND q."questionSetId" IS NULL;
