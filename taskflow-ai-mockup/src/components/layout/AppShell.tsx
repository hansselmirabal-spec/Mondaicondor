import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { FloatingActions } from './FloatingActions'
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer'
import { AutomationPanel } from '@/components/panels/AutomationPanel'
import { ToastContainer } from '@/components/ui/Toast'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { toMockBoard, toMockUser } from '@/lib/adapters'
import type { WorkspaceRole } from '@/store/boardStore'

export function AppShell() {
  const user = useAuthStore(state => state.user)
  const workspaces = useBoardStore(state => state.workspaces)
  const workspace = useBoardStore(state => state.workspace)
  const setWorkspaces = useBoardStore(state => state.setWorkspaces)
  const setWorkspace = useBoardStore(state => state.setWorkspace)
  const setBoards = useBoardStore(state => state.setBoards)
  const setApiUsers = useBoardStore(state => state.setApiUsers)

  useEffect(() => {
    if (workspaces.length > 0) return
    const activeWorkspace = workspace
    async function load() {
      try {
        const { workspaces: list } = await api.workspaces.list()
        if (!list.length) return
        const mapped = list.map(w => ({
          id: w.id,
          name: w.name,
          color: w.color,
          role: w.members.find(m => m.userId === user?.id)?.role as WorkspaceRole | undefined,
        }))
        setWorkspaces(mapped)
        const active = activeWorkspace ?? mapped[0]
        setWorkspace(active)
        const [{ boards: apiBoards }, { workspace: wsDetail }] = await Promise.all([
          api.boards.listByWorkspace(active.id),
          api.workspaces.get(active.id),
        ])
        setBoards(prev => {
          const incoming = apiBoards.map(toMockBoard)
          return incoming.map(nb => {
            const existing = prev.find(b => b.id === nb.id)
            return existing && existing.groups.length > 0 ? existing : nb
          })
        })
        setApiUsers(wsDetail.members.map(m => toMockUser(m.user)))
      } catch {}
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {/* Sidebar — desktop only */}
      <Sidebar />
      {/* Right column: content + mobile bottom nav */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <TaskDetailDrawer />
      <AutomationPanel />
      <FloatingActions />
      <ToastContainer />
    </div>
  )
}
