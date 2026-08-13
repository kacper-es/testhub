-- Cutover 4 sztywnych flag InstanceTestRun → konfigurowalne kolumny wersji.
-- Kolejność: utwórz tabele → backfill (kopie kroków + wartości) → drop 4 kolumn.
-- Postgres ma transakcyjny DDL, więc całość jest atomowa (wszystko albo nic).

-- CreateTable
CREATE TABLE "VersionColumn" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "columnId" TEXT,
    "name" TEXT NOT NULL,
    "fieldType" "ColumnFieldType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "excludedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceRunValue" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "versionColumnId" TEXT NOT NULL,
    "boolValue" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "InstanceRunValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VersionColumn_versionId_excludedAt_idx" ON "VersionColumn"("versionId", "excludedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceRunValue_testRunId_versionColumnId_key" ON "InstanceRunValue"("testRunId", "versionColumnId");

-- AddForeignKey
ALTER TABLE "VersionColumn" ADD CONSTRAINT "VersionColumn_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionColumn" ADD CONSTRAINT "VersionColumn_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRunValue" ADD CONSTRAINT "InstanceRunValue_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "InstanceTestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRunValue" ADD CONSTRAINT "InstanceRunValue_versionColumnId_fkey" FOREIGN KEY ("versionColumnId") REFERENCES "VersionColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceRunValue" ADD CONSTRAINT "InstanceRunValue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: cztery kroki (kopie) na każdą istniejącą wersję. columnId = NULL dla
-- danych historycznych — kolumna jest samowystarczalna (name/fieldType skopiowane).
INSERT INTO "VersionColumn" ("id", "versionId", "columnId", "name", "fieldType", "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, v."id", NULL, x."name", 'CHECKBOX'::"ColumnFieldType", x."ord", CURRENT_TIMESTAMP
FROM "Version" v
CROSS JOIN (VALUES
    ('Środowisko odtworzone', 10),
    ('Skrypty bazodanowe', 20),
    ('Backend podbity', 30),
    ('Testy wykonane', 40)
) AS x("name", "ord");

-- Backfill wartości: dla każdego runu skopiuj 4 flagi do InstanceRunValue,
-- dopasowując krok po nazwie (nazwy są literałami w tej samej migracji).
INSERT INTO "InstanceRunValue" ("id", "testRunId", "versionColumnId", "boolValue", "updatedAt")
SELECT gen_random_uuid()::text, r."id", vc."id",
    CASE vc."name"
        WHEN 'Środowisko odtworzone' THEN r."environmentRestored"
        WHEN 'Skrypty bazodanowe' THEN r."dbScriptsInstalled"
        WHEN 'Backend podbity' THEN r."backendUpdated"
        WHEN 'Testy wykonane' THEN r."testsCompleted"
    END,
    CURRENT_TIMESTAMP
FROM "InstanceTestRun" r
JOIN "VersionColumn" vc ON vc."versionId" = r."versionId";

-- Dopiero teraz usuwamy stare kolumny (dane już przeniesione).
ALTER TABLE "InstanceTestRun" DROP COLUMN "backendUpdated",
DROP COLUMN "dbScriptsInstalled",
DROP COLUMN "environmentRestored",
DROP COLUMN "testsCompleted";
