-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "genome" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "parent1Id" TEXT,
    "parent2Id" TEXT,
    "retiredAt" DATETIME,
    CONSTRAINT "Bug_parent1Id_fkey" FOREIGN KEY ("parent1Id") REFERENCES "Bug" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bug_parent2Id_fkey" FOREIGN KEY ("parent2Id") REFERENCES "Bug" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bug" ("active", "createdAt", "genome", "id", "losses", "name", "updatedAt", "wins") SELECT "active", "createdAt", "genome", "id", "losses", "name", "updatedAt", "wins" FROM "Bug";
DROP TABLE "Bug";
ALTER TABLE "new_Bug" RENAME TO "Bug";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
