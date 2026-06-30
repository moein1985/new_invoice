-- CreateTable
CREATE TABLE "work_report_audits" (
    "id" TEXT NOT NULL,
    "workReportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_report_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_report_audits_workReportId_idx" ON "work_report_audits"("workReportId");

-- AddForeignKey
ALTER TABLE "work_report_audits" ADD CONSTRAINT "work_report_audits_workReportId_fkey" FOREIGN KEY ("workReportId") REFERENCES "work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_report_audits" ADD CONSTRAINT "work_report_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
