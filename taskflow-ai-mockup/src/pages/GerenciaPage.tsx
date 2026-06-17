import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Users, CheckCircle2, Circle, AlertCircle, Clock, ChevronRight, RefreshCw } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toMockBoard, toMockTask } from '@/lib/adapters'
import type { MockBoard, MockTask, WorkspaceStatus } from '@/types'

interface BoardSummary {
  board: MockBoard
  tasks: MockTask[]
  memberCount: number
  loading: boolean
}

const STATUS_DONE_SLUGS = ['Completado', 'Cerrado', 'Done', 'Completada']

function statusColor(slug: string, workspaceStatuses: WorkspaceStatus[]): string {
  const ws = workspaceStatuses.find(s => s.slug === slug || s.label === slug)
  if (ws) return ws.color
  const lower = slug.toLowerCase()
  if (lower.includes('complet') || lower.includes('done') || lower.includes('cerrad')) return '#22c55e'
  if (lower.includes('progreso') || lower.includes('progress')) return '#3b82f6'
  if (lower.includes('bloquead') || lower.includes('block')) return '#ef4444'
  if (lower.includes('revision') || lower.includes('review')) return '#a855f7'
  if (lower.includes('asignad') || lower.includes('assign')) return '#f97316'
  return '#94a3b8'
}

function isDone(slug: string): boolean {
  return STATUS_DONE_SLUGS.some(s => slug.toLowerCase().includes(s.toLowerCase()))
}

function progressPct(tasks: MockTask[]): number {
  if (tasks.length === 0) return 0
  return Math.round((tasks.filter(t => isDone(t.status)).length / tasks.length) * 100)
}

function groupByStatus(tasks: MockTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})
}

function priorityColor(p: string): string {
  if (p === 'Crítica') return '#ef4444'
  if (p === 'Alta') return '#f97316'
  if (p === 'Media') return '#eab308'
  return '#94a3b8'
}

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

interface BoardCardProps {
  summary: BoardSummary
  workspaceStatuses: WorkspaceStatus[]
  onClick: () => void
}

function BoardCard({ summary, workspaceStatuses, onClick }: BoardCardProps) {
  const { board, tasks, memberCount, loading } = summary
  const pct = progressPct(tasks)
  const byStatus = groupByStatus(tasks)
  const pending = tasks.filter(t => !isDone(t.status)).slice(0, 5)
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1])

  return (
    <div
      onClick={onClick}
      className="bg-[#eef1fb] rounded-xl border border-[#d4daf5] hover:border-indigo-300 hover:shadow-lg cursor-pointer transition-all group flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-gray-800 group-hover:text-indigo-700 transition-colors leading-tight">
            {board.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {board.isPrivate && <Lock className="w-3 h-3 text-indigo-400" />}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Members */}
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
          <Users className="w-3 h-3" />
          <span>{memberCount} miembro{memberCount !== 1 ? 's' : ''}</span>
          <span className="mx-1">·</span>
          <span>{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Progress bar */}
        {loading ? (
          <div className="h-1.5 rounded-full bg-gray-200 animate-pulse mb-3" />
        ) : (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">Progreso</span>
              <span className="text-[10px] font-semibold text-indigo-600">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? '#22c55e' : '#6366f1',
                }}
              />
            </div>
          </div>
        )}

        {/* Status breakdown */}
        {!loading && statusEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {statusEntries.slice(0, 4).map(([slug, count]) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: statusColor(slug, workspaceStatuses) }}
              >
                {count} {slug}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 px-4 pb-3 space-y-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-gray-200 animate-pulse" style={{ width: `${70 + i * 10}%` }} />
          ))
        ) : pending.length === 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Todo completado
          </div>
        ) : (
          pending.map(task => {
            const days = daysUntil(task.deadline)
            const overdue = days !== null && days < 0
            return (
              <div key={task.id} className="flex items-center gap-1.5 py-0.5">
                <Circle
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ color: statusColor(task.status, workspaceStatuses) }}
                />
                <span className="text-[11px] text-gray-700 truncate flex-1 leading-tight">
                  {task.title}
                </span>
                {overdue && (
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                )}
                {!overdue && days !== null && days <= 3 && (
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                )}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: priorityColor(task.priority) }}
                />
              </div>
            )
          })
        )}
        {!loading && tasks.filter(t => !isDone(t.status)).length > 5 && (
          <p className="text-[10px] text-gray-400 pt-0.5">
            +{tasks.filter(t => !isDone(t.status)).length - 5} más pendientes
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#d4daf5] bg-white/40">
        <div className="flex items-center gap-1.5">
          {board.groups.slice(0, 3).map(g => (
            <span
              key={g.id}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: g.color }}
            />
          ))}
          {board.groups.length > 3 && (
            <span className="text-[10px] text-gray-400">+{board.groups.length - 3}</span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{board.groups.length} grupo{board.groups.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

export function GerenciaPage() {
  const navigate = useNavigate()
  const { boards, workspace } = useBoardStore()
  const workspaceId = workspace?.id ?? null

  const [summaries, setSummaries] = useState<BoardSummary[]>([])
  const [workspaceStatuses, setWorkspaceStatuses] = useState<WorkspaceStatus[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!workspaceId) return
    if (!silent) setGlobalLoading(true)
    else setRefreshing(true)

    try {
      const [{ boards: apiBoards }, { statuses }] = await Promise.all([
        api.boards.listByWorkspace(workspaceId),
        api.workspaces.listStatuses(workspaceId),
      ])

      setWorkspaceStatuses(statuses as WorkspaceStatus[])

      const initial: BoardSummary[] = apiBoards.map(b => ({
        board: toMockBoard(b),
        tasks: [],
        memberCount: (b.boardMembers ?? []).length,
        loading: true,
      }))
      setSummaries(initial)
      setGlobalLoading(false)

      // Load tasks for each board in parallel
      const results = await Promise.allSettled(
        apiBoards.map(b => api.tasks.listByBoard(b.id))
      )

      setSummaries(prev =>
        prev.map((s, i) => {
          const result = results[i]
          if (result.status === 'fulfilled') {
            return { ...s, tasks: result.value.tasks.map(toMockTask), loading: false }
          }
          return { ...s, loading: false }
        })
      )
    } catch {
      setGlobalLoading(false)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [workspaceId])

  const totalTasks = summaries.reduce((acc, s) => acc + s.tasks.length, 0)
  const completedTasks = summaries.reduce((acc, s) => acc + s.tasks.filter(t => isDone(t.status)).length, 0)
  const overallPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  if (globalLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Cargando vista gerencia...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vista Gerencia</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Resumen de todos los tableros · {summaries.length} tablero{summaries.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-indigo-600 font-medium">{overallPct}% completado</span>
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

        {/* Global KPI bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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
        </div>

        {/* Board grid */}
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
  )
}
