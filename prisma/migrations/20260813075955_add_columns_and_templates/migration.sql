-- CreateEnum
CREATE TYPE "ColumnFieldType" AS ENUM ('CHECKBOX');

-- CreateTable
CREATE TABLE "Column" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldType" "ColumnFieldType" NOT NULL DEFAULT 'CHECKBOX',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Column_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColumnTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ColumnTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ColumnTemplateItem_templateId_columnId_key" ON "ColumnTemplateItem"("templateId", "columnId");

-- AddForeignKey
ALTER TABLE "ColumnTemplateItem" ADD CONSTRAINT "ColumnTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ColumnTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnTemplateItem" ADD CONSTRAINT "ColumnTemplateItem_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
