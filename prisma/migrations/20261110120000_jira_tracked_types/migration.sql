-- CreateTable
CREATE TABLE "JiraTrackedType" (
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "JiraTrackedType_pkey" PRIMARY KEY ("name")
);

