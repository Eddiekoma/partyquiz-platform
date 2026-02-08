-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "scoringSettingsJson" JSONB;

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
