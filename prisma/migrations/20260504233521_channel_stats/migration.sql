-- CreateTable
CREATE TABLE "ChannelStat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelStat_clientId_channel_rangeStart_idx" ON "ChannelStat"("clientId", "channel", "rangeStart");

-- AddForeignKey
ALTER TABLE "ChannelStat" ADD CONSTRAINT "ChannelStat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
