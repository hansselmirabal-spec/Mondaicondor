-- CreateTable
CREATE TABLE "_TaskToWorkspaceUen" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Migrate existing uenId data to the join table
INSERT INTO "_TaskToWorkspaceUen" ("A", "B")
SELECT "id", "uenId" FROM "Task" WHERE "uenId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "_TaskToWorkspaceUen_AB_unique" ON "_TaskToWorkspaceUen"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskToWorkspaceUen_B_index" ON "_TaskToWorkspaceUen"("B");

-- AddForeignKey
ALTER TABLE "_TaskToWorkspaceUen" ADD CONSTRAINT "_TaskToWorkspaceUen_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskToWorkspaceUen" ADD CONSTRAINT "_TaskToWorkspaceUen_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkspaceUen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_uenId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Task_uenId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN IF EXISTS "uenId";
