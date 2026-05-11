-- AlterTable
ALTER TABLE "AdAccount" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "businessName" TEXT;

-- CreateIndex
CREATE INDEX "AdAccount_businessId_idx" ON "AdAccount"("businessId");
