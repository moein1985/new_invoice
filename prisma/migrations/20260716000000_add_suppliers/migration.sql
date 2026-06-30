-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- AlterTable: Add supplierId to purchase_inquiries
ALTER TABLE "purchase_inquiries" ADD COLUMN "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_inquiries_supplierId_idx" ON "purchase_inquiries"("supplierId");

-- AddForeignKey
ALTER TABLE "purchase_inquiries" ADD CONSTRAINT "purchase_inquiries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
