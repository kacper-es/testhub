-- CreateTable
CREATE TABLE "JiraSnapshot" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "inProgress" INTEGER NOT NULL,

    CONSTRAINT "JiraSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraSnapshot_versionId_day_key" ON "JiraSnapshot"("versionId", "day");

-- AddForeignKey
ALTER TABLE "JiraSnapshot" ADD CONSTRAINT "JiraSnapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

