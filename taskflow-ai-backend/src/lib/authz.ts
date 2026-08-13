import { prisma } from './prisma.js'

// Single source of truth for workspace-admin authorization.
// A caller is a workspace admin if they hold WorkspaceMember.role === 'ADMIN'
// in that workspace, OR they are a global system admin (User.isAppAdmin).
export async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const [membership, user] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } }),
  ])
  return membership?.role === 'ADMIN' || user?.isAppAdmin === true
}
