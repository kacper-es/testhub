-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TESTER', 'PM', 'ADMIN');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('IN_PROGRESS', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CHECKBOX', 'TICKET_AGGREGATE', 'INSTANCE_AGGREGATE');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('FLEXIBLE', 'DAYS_BEFORE_RELEASE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "releaseDate" DATE NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdById" TEXT NOT NULL,
    "statusChangedById" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "TaskType" NOT NULL,
    "deadlineType" "DeadlineType" NOT NULL,
    "daysBeforeRelease" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionTask" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "taskTemplateId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "manualCounterCurrent" INTEGER NOT NULL DEFAULT 0,
    "manualCounterTotal" INTEGER NOT NULL DEFAULT 0,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nameSnapshot" TEXT,
    "descriptionSnapshot" TEXT,
    "taskTypeSnapshot" "TaskType",
    "deadlineTypeSnapshot" "DeadlineType",
    "daysBeforeReleaseSnapshot" INTEGER,
    "sortOrderSnapshot" INTEGER,

    CONSTRAINT "VersionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "keyFunctionalities" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceTestRun" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "environmentRestored" BOOLEAN NOT NULL DEFAULT false,
    "dbScriptsInstalled" BOOLEAN NOT NULL DEFAULT false,
    "backendUpdated" BOOLEAN NOT NULL DEFAULT false,
    "testsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "excludedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "InstanceTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionComment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "versionId" TEXT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Version_name_key" ON "Version"("name");

-- CreateIndex
CREATE INDEX "Version_status_releaseDate_idx" ON "Version"("status", "releaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "VersionTask_versionId_taskTemplateId_key" ON "VersionTask"("versionId", "taskTemplateId");

-- CreateIndex
CREATE INDEX "InstanceTestRun_versionId_excludedAt_idx" ON "InstanceTestRun"("versionId", "excludedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceTestRun_versionId_instanceId_key" ON "InstanceTestRun"("versionId", "instanceId");

-- CreateIndex
CREATE INDEX "VersionComment_versionId_createdAt_idx" ON "VersionComment"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_versionId_createdAt_idx" ON "ChangeLog"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_field_createdAt_idx" ON "ChangeLog"("entityType", "entityId", "field", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionTask" ADD CONSTRAINT "VersionTask_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionTask" ADD CONSTRAINT "VersionTask_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "TaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionTask" ADD CONSTRAINT "VersionTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceTestRun" ADD CONSTRAINT "InstanceTestRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceTestRun" ADD CONSTRAINT "InstanceTestRun_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceTestRun" ADD CONSTRAINT "InstanceTestRun_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionComment" ADD CONSTRAINT "VersionComment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionComment" ADD CONSTRAINT "VersionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
