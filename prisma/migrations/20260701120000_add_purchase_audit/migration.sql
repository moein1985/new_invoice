-- CreateTable
CREATE TABLE "purchase_audits" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_audits_purchaseRequestId_idx" ON "purchase_audits"("purchaseRequestId");

-- AddForeignKey
ALTER TABLE "purchase_audits" ADD CONSTRAINT "purchase_audits_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_audits" ADD CONSTRAINT "purchase_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
