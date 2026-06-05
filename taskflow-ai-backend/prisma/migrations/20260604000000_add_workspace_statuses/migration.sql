-- CreateTable WorkspaceStatus
CREATE TABLE "WorkspaceStatus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#c4c4c4',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceStatus_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX "WorkspaceStatus_workspaceId_slug_key" ON "WorkspaceStatus"("workspaceId", "slug");

-- AddForeignKey
ALTER TABLE "WorkspaceStatus" ADD CONSTRAINT "WorkspaceStatus_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterColumn Task.status: enum -> text
ALTER TABLE "Task" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'Nuevo';

-- AlterColumn BoardSettings.defaultStatus: enum -> text
ALTER TABLE "BoardSettings" ALTER COLUMN "defaultStatus" TYPE TEXT USING "defaultStatus"::text;
ALTER TABLE "BoardSettings" ALTER COLUMN "defaultStatus" SET DEFAULT 'Nuevo';

-- DropEnum
DROP TYPE IF EXISTS "TaskStatus";
