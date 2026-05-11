-- CreateEnum
CREATE TYPE "ClientLibraryItemType" AS ENUM ('NOTE', 'CREDENTIAL', 'LINK');

-- CreateTable
CREATE TABLE "ClientLibraryItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientLibraryItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "bodyEnc" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientLibraryItem_clientId_type_createdAt_idx" ON "ClientLibraryItem"("clientId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientLibraryItem" ADD CONSTRAINT "ClientLibraryItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
