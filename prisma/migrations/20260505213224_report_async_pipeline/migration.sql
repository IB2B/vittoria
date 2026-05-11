-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "contextNote" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "narrativeJson" JSONB,
ADD COLUMN     "phaseLabel" TEXT,
ADD COLUMN     "prioritiesJson" JSONB,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");
