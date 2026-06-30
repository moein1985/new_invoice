-- AlterTable: Add SIP/CTI fields to users
ALTER TABLE "users" ADD COLUMN "sipServer" TEXT;
ALTER TABLE "users" ADD COLUMN "sipPort" INTEGER DEFAULT 8089;
ALTER TABLE "users" ADD COLUMN "sipUsername" TEXT;
ALTER TABLE "users" ADD COLUMN "sipPassword" TEXT;
ALTER TABLE "users" ADD COLUMN "sipExtension" TEXT;
ALTER TABLE "users" ADD COLUMN "sipEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "sipTransport" TEXT DEFAULT 'ws';
