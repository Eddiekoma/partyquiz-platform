-- AlterTable
ALTER TABLE "QuestionMedia" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "QuestionMedia_questionId_displayOrder_idx" ON "QuestionMedia"("questionId", "displayOrder");
