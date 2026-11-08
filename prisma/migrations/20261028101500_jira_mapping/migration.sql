-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "jiraProjectKey" TEXT;

-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "jiraVersionId" TEXT,
ADD COLUMN     "jiraVersionName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Application_jiraProjectKey_key" ON "Application"("jiraProjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Version_jiraVersionId_key" ON "Version"("jiraVersionId");

