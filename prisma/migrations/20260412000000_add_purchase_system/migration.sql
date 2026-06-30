-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PENDING_INQUIRY', 'INQUIRED', 'APPROVED', 'REJECTED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "PurchasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ItemAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'PROFORMA', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PURCHASE_REJECTED';

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "voiceNote" TEXT,
    "priority" "PurchasePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "approvedInquiryId" TEXT,
    "deadline" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_inquiries" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierPhone" TEXT,
    "supplierAddress" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paymentDays" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_items" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "availability" "ItemAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "deliveryDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_attachments" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_requestNumber_key" ON "purchase_requests"("requestNumber");
CREATE UNIQUE INDEX "purchase_requests_approvedInquiryId_key" ON "purchase_requests"("approvedInquiryId");
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");
CREATE INDEX "purchase_requests_createdById_idx" ON "purchase_requests"("createdById");
CREATE INDEX "purchase_requests_assignedToId_idx" ON "purchase_requests"("assignedToId");
CREATE INDEX "purchase_requests_projectId_idx" ON "purchase_requests"("projectId");
CREATE INDEX "purchase_requests_createdAt_idx" ON "purchase_requests"("createdAt");
CREATE INDEX "purchase_inquiries_purchaseRequestId_idx" ON "purchase_inquiries"("purchaseRequestId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approvedInquiryId_fkey" FOREIGN KEY ("approvedInquiryId") REFERENCES "purchase_inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_inquiries" ADD CONSTRAINT "purchase_inquiries_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_inquiries" ADD CONSTRAINT "purchase_inquiries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "purchase_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "purchase_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "purchase_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
