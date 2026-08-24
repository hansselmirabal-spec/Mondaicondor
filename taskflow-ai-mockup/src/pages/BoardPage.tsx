import { useParams, Navigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { BoardHeader } from '@/components/board/BoardHeader'
import { BoardViewTabs } from '@/components/board/BoardViewTabs'
import { BoardToolbar } from '@/components/board/BoardToolbar'
import { BoardTable } from '@/components/board/BoardTable'
import { KanbanView } from '@/components/board/KanbanView'
import { ChartView } from '@/components/board/ChartView'
import { api } from '@/lib/api'
import { toMockBoard, extractTasks, toMockTask, toMockUser } from '@/lib/adapters'
import type { MockBoard, WorkspaceStatus } from '@/types'

const POLL_INTERVAL_MS = 5_000

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { setBoards, setApiTasks, setWorkspaceStatuses, setWorkspaceUens, setApiUsers, setCustomFieldDefinitions } = useBoardStore()
  const boards = useBoardStore(state => state.boards)
  const activeView = useFilterStore(state => state.activeView)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const activeBoardId = useRef(boardId)

  const refreshTasks = useCallback(async (id: string) => {
    try {
      const { tasks } = await api.tasks.listByBoard(id)
      if (activeBoardId.current !== id) return
      setApiTasks(tasks.map(t => toMockTask(t)))
    } catch {
      // silent — poll failures shouldn't break the UI
    }
  }, [setApiTasks])

  useEffect(() => {
    if (!boardId) return
    activeBoardId.current = boardId
    setLoading(true)
    setNotFound(false)
    async function load() {
      try {
        const { board: apiBoard } = await api.boards.get(boardId!)
        // Guard: ignore stale responses if the user navigated away
        if (activeBoardId.current !== boardId) return
        const mockBoard = toMockBoard(apiBoard)
        setBoards(prev => {
          const idx = prev.findIndex(b => b.id === boardId)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = mockBoard
            return next
          }
          return [...prev, mockBoard]
        })
        const { tasks } = await api.tasks.listByBoard(boardId!)
        if (activeBoardId.current === boardId) setApiTasks(tasks.map(t => toMockTask(t)))
        api.workspaces.listStatuses(apiBoard.workspaceId)
          .then(({ statuses }) => {
            if (activeBoardId.current === boardId) setWorkspaceStatuses(statuses as WorkspaceStatus[])
          })
          .catch(() => {})
        api.workspaces.listUens(apiBoard.workspaceId)
          .then(({ uens }) => {
            if (activeBoardId.current === boardId) setWorkspaceUens(uens)
          })
          .catch(() => {})
        api.workspaces.get(apiBoard.workspaceId)
          .then(({ workspace }) => {
            if (activeBoardId.current !== boardId) return
            setApiUsers(workspace.members.map(m => toMockUser(m.user)))
          })
          .catch(() => {})
        // includeArchived=true: archived fields with values already loaded still
        // need to render read-only in TaskRow (Phase 2c contract), so both active
        // and archived definitions must be available here, not just active ones.
        api.boards.listCustomFields(boardId!, true)
          .then(({ customFieldDefinitions }) => {
            if (activeBoardId.current === boardId) setCustomFieldDefinitions(customFieldDefinitions)
          })
          .catch(() => {})
      } catch {
        if (activeBoardId.current === boardId) setNotFound(true)
      } finally {
        if (activeBoardId.current === boardId) setLoading(false)
      }
    }
    load()

    const poll = setInterval(() => refreshTasks(boardId), POLL_INTERVAL_MS)
    return () => clearInterval(poll)
  }, [boardId, refreshTasks])

  const board: MockBoard | null = boardId ? (boards.find(b => b.id === boardId) ?? null) : null

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-400">Cargando tablero...</p>
    </div>
  )
  if (notFound || !board) return <Navigate to="/boards" replace />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BoardHeader board={board} />
      <BoardViewTabs />
      <BoardToolbar />
      {activeView === 'table'  && <BoardTable board={board} />}
      {activeView === 'kanban' && <KanbanView board={board} />}
      {activeView === 'chart'  && <ChartView board={board} />}
    </div>
  )
}
