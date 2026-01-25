/*
  Warnings:

  - You are about to drop the column `views` on the `MediaItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Marker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Marker_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "markerIcons" TEXT NOT NULL DEFAULT '["💦","👄","🍑","🐄","🦶","💕","🚀","🛑"]',
    "autoResume" BOOLEAN NOT NULL DEFAULT true,
    "quickActionMode" TEXT NOT NULL DEFAULT 'highlight',
    "quickActionIcon" TEXT NOT NULL DEFAULT '✨',
    "quickActionLabel" TEXT NOT NULL DEFAULT 'Highlight',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "thumbnail" TEXT,
    "type" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "filePath" TEXT,
    "metadata" TEXT,
    "duration" INTEGER,
    "pages" INTEGER,
    "size" BIGINT,
    "lastPos" REAL NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MediaItem" ("createdAt", "description", "duration", "filePath", "id", "isArchived", "pages", "rating", "thumbnail", "title", "type", "updatedAt", "url") SELECT "createdAt", "description", "duration", "filePath", "id", "isArchived", "pages", "rating", "thumbnail", "title", "type", "updatedAt", "url" FROM "MediaItem";
DROP TABLE "MediaItem";
ALTER TABLE "new_MediaItem" RENAME TO "MediaItem";
CREATE UNIQUE INDEX "MediaItem_filePath_key" ON "MediaItem"("filePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
