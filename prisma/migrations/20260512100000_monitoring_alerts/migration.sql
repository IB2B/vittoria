-- CreateEnum
CREATE TYPE "MonitoringSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "MonitoringStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "MonitoringAlert" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "severity" "MonitoringSeverity" NOT NULL,
    "status" "MonitoringStatus" NOT NULL DEFAULT 'OPEN',
    "metrics" JSONB NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringAlert_dedupKey_key" ON "MonitoringAlert"("dedupKey");

-- CreateIndex
CREATE INDEX "MonitoringAlert_clientId_status_severity_idx" ON "MonitoringAlert"("clientId", "status", "severity");

-- CreateIndex
CREATE INDEX "MonitoringAlert_status_severity_detectedAt_idx" ON "MonitoringAlert"("status", "severity", "detectedAt");

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
