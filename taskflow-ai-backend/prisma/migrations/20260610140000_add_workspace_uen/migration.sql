CREATE TABLE IF NOT EXISTS "WorkspaceUen" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceUen_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "uenId" TEXT;

ALTER TABLE "WorkspaceUen" ADD CONSTRAINT "WorkspaceUen_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_uenId_fkey"
  FOREIGN KEY ("uenId") REFERENCES "WorkspaceUen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "WorkspaceUen_workspaceId_idx" ON "WorkspaceUen"("workspaceId");
CREATE INDEX IF NOT EXISTS "Task_uenId_idx" ON "Task"("uenId");
