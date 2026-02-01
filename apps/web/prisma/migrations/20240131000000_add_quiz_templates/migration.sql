-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Quiz_isTemplate_idx" ON "Quiz"("isTemplate");
