import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock, CheckCircle2, Circle, AlertCircle, Clock,
  ChevronRight, RefreshCw, ShieldOff, X, CalendarX, CalendarClock,
} from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { toMockBoard } from '@/lib/adapters'
import type { MockBoard, WorkspaceStatus } from '@/types'
import type { ApiTask } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardSummary {
  board: MockBoard
  tasks: ApiTask[]
  memberCount: number
  loading: boolean
}

interface TaskWithBoard extends ApiTask {
  boardName: string
  boardId: string
}

type ModalType = 'overdue' | 'today'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DONE_SLUGS = ['completado', 'cerrado', 'done', 'completada']

function isDone(status: string): boolean {
  return DONE_SLUGS.some(s => status.toLowerCase().includes(s))
}

function statusColor(slug: string, ws: WorkspaceStatus[]): string {
  const found = ws.find(s => s.slug === slug || s.label === slug)
  if (found) return found.color
  const l = slug.toLowerCase()
  if (l.includes('complet') || l.includes('done') || l.includes('cerrad')) return '#22c55e'
  if (l.includes('progreso') || l.includes('progress')) return '#3b82f6'
  if (l.includes('bloquead') || l.includes('block')) return '#ef4444'
  if (l.includes('revision') || l.includes('review')) return '#a855f7'
  if (l.includes('asignad') || l.includes('assign')) return '#f97316'
  return '#94a3b8'
}

function priorityColor(p: string): string {
  if (p === 'Critica') return '#ef4444'
  if (p === 'Alta') return '#f97316'
  if (p === 'Media') return '#eab308'
  return '#94a3b8'
}

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(deadline: string | null): string {
  if (!deadline) return ''
  const d = new Date(deadline)
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })
}

// ── TaskListModal ─────────────────────────────────────────────────────────────

interface TaskListModalProps {
  type: ModalType
  tasks: TaskWithBoard[]
  workspaceStatuses: WorkspaceStatus[]
  onClose: () => void
  onNavigate: (boardId: string) => void
}

function TaskListModal({ type, tasks, workspaceStatuses, onClose, onNavigate }: TaskListModalProps) {
  const isOverdue = type === 'overdue'
  const title = isOverdue ? 'Tareas vencidas' : 'Vencen hoy'
  const accentColor = isOverdue ? 'text-red-600' : 'text-amber-600'
  const bgColor = isOverdue ? 'bg-red-50' : 'bg-amber-50'
  const borderColor = isOverdue ? 'border-red-200' : 'border-amber-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor} ${bgColor}`}>
          <div className="flex items-center gap-2">
            {isOverdue
              ? <CalendarX className={`w-5 h-5 ${accentColor}`} />
              : <CalendarClock className={`w-5 h-5 ${accentColor}`} />
            }
            <h2 className={`text-base font-bold ${accentColor}`}>{title}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bgColor} border ${borderColor} ${accentColor}`}>
              {tasks.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              No hay tareas en esta categoría.
            </div>
          ) : (
            tasks.map(task => {
              const assigneeNames = task.assignees.map(a => a.user.name.split(' ')[0]).join(', ')
              const days = daysUntil(task.deadline ?? null)
              const overdue = days !== null && days < 0

              return (
                <button
                  key={task.id}
                  onClick={() => { onNavigate(task.boardId); onClose() }}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <Circle
                    className="w-3 h-3 mt-1 shrink-0"
                    style={{ color: statusColor(task.status, workspaceStatuses) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-indigo-500 truncate">{task.boardName}</span>
                      {assigneeNames && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-500 truncate">{assigneeNames}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    overdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {overdue
                      ? <AlertCircle className="w-3 h-3" />
                      : <Clock className="w-3 h-3" />
                    }
                    {fmtDate(task.deadline ?? null)}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── BoardCard ─────────────────────────────────────────────────────────────────

interface BoardCardProps {
  summary: BoardSummary
  workspaceStatuses: WorkspaceStatus[]
  onClick: () => void
}

function BoardCard({ summary, workspaceStatuses, onClick }: BoardCardProps) {
  const { board, tasks, loading } = summary

  // Group pending tasks by their groupId, preserving board group order
  const pendingByGroup = board.groups.map(g => ({
    group: g,
    tasks: tasks.filter(t => t.groupId === g.id && !isDone(t.status)).slice(0, 5),
  })).filter(g => g.tasks.length > 0)

  const totalPending = tasks.filter(t => !isDone(t.status)).length

  return (
    <div
      onClick={onClick}
      className="bg-[#eef1fb] rounded-xl border border-[#d4daf5] hover:border-indigo-300 hover:shadow-lg cursor-pointer transition-all group flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-800 group-hover:text-indigo-700 transition-colors leading-tight">
            {board.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {board.isPrivate && <Lock className="w-3 h-3 text-indigo-400" />}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {totalPending} pendiente{totalPending !== 1 ? 's' : ''}
          {tasks.length > 0 && ` · ${tasks.length} total`}
        </p>
      </div>

      {/* Tasks by group */}
      <div className="flex-1 pb-3 overflow-hidden">
        {loading ? (
          <div className="px-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-gray-200 animate-pulse" style={{ width: `${55 + i * 12}%` }} />
            ))}
          </div>
        ) : pendingByGroup.length === 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium px-4 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Todo completado
          </div>
        ) : (
          pendingByGroup.map((entry, idx) => (
            <div key={entry.group.id}>
              {/* Group divider */}
              {idx > 0 && <div className="border-t border-[#d4daf5] mx-4 my-2" />}

              {/* Group name */}
              <div className="flex items-center gap-1.5 px-4 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.group.color }} />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">
                  {entry.group.name}
                </span>
              </div>

              {/* Tasks in group */}
              <div className="px-4 space-y-1">
                {entry.tasks.map(task => {
                  const days = daysUntil(task.deadline ?? null)
                  const overdue = days !== null && days < 0
                  const soon = !overdue && days !== null && days <= 3

                  return (
                    <div key={task.id} className="flex items-center gap-1.5">
                      <Circle
                        className="w-2.5 h-2.5 shrink-0"
                        style={{ color: statusColor(task.status, workspaceStatuses) }}
                      />
                      <span className="text-[11px] text-gray-700 truncate flex-1 leading-tight">
                        {task.title}
                      </span>
                      {task.deadline && (
                        <span className={`text-[10px] flex items-center gap-0.5 shrink-0 font-medium px-1 py-0.5 rounded ${
                          overdue
                            ? 'bg-red-100 text-red-600'
                            : soon
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {overdue && <AlertCircle className="w-2.5 h-2.5" />}
                          {soon && !overdue && <Clock className="w-2.5 h-2.5" />}
                          {fmtDate(task.deadline ?? null)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GerenciaPage() {
  const navigate = useNavigate()
  const { workspace } = useBoardStore()
  const { user } = useAuthStore()
  const workspaceId = workspace?.id ?? null

  const [summaries, setSummaries] = useState<BoardSummary[]>([])
  const [workspaceStatuses, setWorkspaceStatuses] = useState<WorkspaceStatus[]>([])
  const [userRole, setUserRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER' | null>(null)
  const [globalLoading, setGlobalLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [taskModal, setTaskModal] = useState<ModalType | null>(null)

  async function load(silent = false) {
    if (!workspaceId || !user) return
    if (!silent) setGlobalLoading(true)
    else setRefreshing(true)

    try {
      const [{ boards: apiBoards }, { statuses }, wsDetail] = await Promise.all([
        api.boards.listByWorkspace(workspaceId),
        api.workspaces.listStatuses(workspaceId),
        api.workspaces.get(workspaceId),
      ])

      // Resolve current user's workspace role
      const myMembership = wsDetail.workspace.members.find(m => m.userId === user.id)
      const role = (myMembership?.role ?? 'MEMBER') as 'ADMIN' | 'MEMBER' | 'VIEWER'
      setUserRole(role)

      // Only ADMIN or app admin can proceed
      if (role !== 'ADMIN' && !user.isAppAdmin) {
        setGlobalLoading(false)
        return
      }

      setWorkspaceStatuses(statuses as WorkspaceStatus[])

      const initial: BoardSummary[] = apiBoards.map(b => ({
        board: toMockBoard(b),
        tasks: [],
        memberCount: (b.boardMembers ?? []).length,
        loading: true,
      }))
      setSummaries(initial)
      setGlobalLoading(false)

      // Load tasks for all boards in parallel
      const results = await Promise.allSettled(
        apiBoards.map(b => api.tasks.listByBoard(b.id))
      )

      setSummaries(prev =>
        prev.map((s, i) => {
          const r = results[i]
          return r.status === 'fulfilled'
            ? { ...s, tasks: r.value.tasks, loading: false }
            : { ...s, loading: false }
        })
      )
    } catch {
      setGlobalLoading(false)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [workspaceId, user?.id])

  // ── Access denied ────────────────────────────────────────────────────────────

  if (!globalLoading && userRole !== 'ADMIN' && !user?.isAppAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800">Acceso restringido</p>
          <p className="text-sm text-gray-400 mt-1">
            La vista de gerencia es solo para administradores del workspace.
          </p>
        </div>
        <button
          onClick={() => navigate('/boards')}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Volver a tableros
        </button>
      </div>
    )
  }

  if (globalLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Cargando vista gerencia...</p>
      </div>
    )
  }

  const totalTasks = summaries.reduce((acc, s) => acc + s.tasks.length, 0)
  const completedTasks = summaries.reduce((acc, s) => acc + s.tasks.filter(t => isDone(t.status)).length, 0)
  const overallPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  const todayStr = new Date().toISOString().slice(0, 10)

  const allTasksWithBoard: TaskWithBoard[] = summaries.flatMap(s =>
    s.tasks.map(t => ({ ...t, boardName: s.board.name, boardId: s.board.id }))
  )

  const overdueTasks = allTasksWithBoard.filter(t => {
    if (!t.deadline || isDone(t.status)) return false
    return t.deadline.slice(0, 10) < todayStr
  })

  const todayTasks = allTasksWithBoard.filter(t => {
    if (!t.deadline || isDone(t.status)) return false
    return t.deadline.slice(0, 10) === todayStr
  })

  const modalTasks = taskModal === 'overdue' ? overdueTasks : todayTasks

  return (
    <>
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vista Gerencia</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {summaries.length} tablero{summaries.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-indigo-600 font-medium">{overallPct}% completado global</span>
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Tableros activos</p>
            <p className="text-2xl font-bold text-gray-900">{summaries.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Tareas totales</p>
            <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
            <p className="text-xs text-gray-400">{completedTasks} completadas</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Progreso global</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${overallPct}%`, backgroundColor: overallPct === 100 ? '#22c55e' : '#6366f1' }}
                />
              </div>
              <span className="text-sm font-bold text-indigo-600">{overallPct}%</span>
            </div>
          </div>

          {/* Vencidas */}
          <button
            onClick={() => overdueTasks.length > 0 && setTaskModal('overdue')}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              overdueTasks.length > 0
                ? 'bg-red-50 border-red-200 hover:border-red-400 hover:shadow-md cursor-pointer'
                : 'bg-gray-50 border-gray-200 cursor-default opacity-60'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <CalendarX className={`w-3.5 h-3.5 ${overdueTasks.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <p className={`text-xs font-medium ${overdueTasks.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                Vencidas
              </p>
            </div>
            <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {overdueTasks.length}
            </p>
            {overdueTasks.length > 0 && (
              <p className="text-[10px] text-red-400 mt-0.5">Ver listado →</p>
            )}
          </button>

          {/* Vencen hoy */}
          <button
            onClick={() => todayTasks.length > 0 && setTaskModal('today')}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              todayTasks.length > 0
                ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer'
                : 'bg-gray-50 border-gray-200 cursor-default opacity-60'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <CalendarClock className={`w-3.5 h-3.5 ${todayTasks.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
              <p className={`text-xs font-medium ${todayTasks.length > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                Vencen hoy
              </p>
            </div>
            <p className={`text-2xl font-bold ${todayTasks.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {todayTasks.length}
            </p>
            {todayTasks.length > 0 && (
              <p className="text-[10px] text-amber-400 mt-0.5">Ver listado →</p>
            )}
          </button>
        </div>

        {/* Grid */}
        {summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-sm">No hay tableros disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {summaries.map(s => (
              <BoardCard
                key={s.board.id}
                summary={s}
                workspaceStatuses={workspaceStatuses}
                onClick={() => navigate(`/boards/${s.board.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {taskModal && (
      <TaskListModal
        type={taskModal}
        tasks={modalTasks}
        workspaceStatuses={workspaceStatuses}
        onClose={() => setTaskModal(null)}
        onNavigate={boardId => navigate(`/boards/${boardId}`)}
      />
    )}
    </>
  )
}
