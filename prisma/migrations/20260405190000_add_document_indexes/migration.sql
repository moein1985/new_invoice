-- Add performance indexes for document list filtering/sorting
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");
CREATE INDEX "documents_documentType_idx" ON "documents"("documentType");
CREATE INDEX "documents_customerId_idx" ON "documents"("customerId");
CREATE INDEX "documents_approvalStatus_idx" ON "documents"("approvalStatus");
CREATE INDEX "documents_issueDate_idx" ON "documents"("issueDate");
