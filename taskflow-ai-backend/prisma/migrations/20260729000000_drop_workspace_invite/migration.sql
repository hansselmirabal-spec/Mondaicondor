-- DropForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT IF EXISTS "WorkspaceInvite_workspaceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "WorkspaceInvite";
