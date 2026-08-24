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

// Single source of truth for board-admin authorization (custom fields, etc.).
// A caller can administer a board's custom fields if they hold
// BoardMember.role === 'ADMIN' on that board, OR they are a workspace admin
// (which already covers isAppAdmin internally). The workspace-admin fallback
// is needed because public boards don't always have an explicit BoardMember
// row for every workspace member (see assertBoardAccess in boards.ts).
export async function isBoardAdmin(boardId: string, userId: string): Promise<boolean> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } })
  if (!board) return false

  const boardMember = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  })
  if (boardMember?.role === 'ADMIN') return true

  return isWorkspaceAdmin(board.workspaceId, userId)
}
