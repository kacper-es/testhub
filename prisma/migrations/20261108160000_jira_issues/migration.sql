-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "jiraSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JiraIssue" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "statusName" TEXT NOT NULL,
    "statusCategory" TEXT NOT NULL,
    "assigneeName" TEXT,
    "jiraUpdatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "JiraIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JiraIssue_versionId_removedAt_idx" ON "JiraIssue"("versionId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JiraIssue_versionId_jiraId_key" ON "JiraIssue"("versionId", "jiraId");

-- AddForeignKey
ALTER TABLE "JiraIssue" ADD CONSTRAINT "JiraIssue_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

