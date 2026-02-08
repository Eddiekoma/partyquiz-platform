/*
  Warnings:

  - Made the column `lastActiveAt` on table `LivePlayer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LivePlayer" ALTER COLUMN "lastActiveAt" SET NOT NULL;
