import type { MockBoard } from '@/types'
import type { ApiUser } from '@/lib/api'
import type { WorkspaceMemberLite } from '@/store/boardStore'

interface WorkspaceLite {
  id: string
  members?: WorkspaceMemberLite[]
}

// Client-side mirror of `isBoardAdmin` in taskflow-ai-backend/src/lib/authz.ts:
// real ADMIN of this board's BoardMember row, OR ADMIN of the board's
// workspace (fallback for public boards without an explicit BoardMember row),
// OR app admin. Used to gate board-admin-only UI before the backend re-checks
// the same rule on every write endpoint.
export function isBoardAdminClient(
  board: MockBoard | null | undefined,
  user: ApiUser | null | undefined,
  workspaces: WorkspaceLite[],
): boolean {
  if (!board || !user) return false
  if (user.isAppAdmin === true) return true
  if (board.boardMembers?.some(m => m.userId === user.id && m.role === 'ADMIN')) return true
  return workspaces
    .find(w => w.id === board.workspaceId)
    ?.members?.some(m => m.userId === user.id && m.role === 'ADMIN') ?? false
}
