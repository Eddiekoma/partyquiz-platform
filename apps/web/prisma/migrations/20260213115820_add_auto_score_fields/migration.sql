-- AlterTable
ALTER TABLE "LiveAnswer" ADD COLUMN     "autoScore" INTEGER,
ADD COLUMN     "autoScorePercentage" INTEGER,
ADD COLUMN     "isManuallyAdjusted" BOOLEAN NOT NULL DEFAULT false;
