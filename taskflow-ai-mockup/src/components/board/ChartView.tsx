import type { MockBoard, PriorityType } from '@/types'
import { useBoardStore } from '@/store/boardStore'
import { getStatusInfo, getPriorityStyle } from '@/lib/utils'

const PRIORITIES: PriorityType[] = ['Siempre activo', 'Crítica', 'Alta', 'Media', 'Baja']

interface BarProps {
  label: string
  count: number
  max: number
  color: string
  textColor: string
}

function Bar({ label, count, max, color, textColor }: BarProps) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div
          className="h-full rounded-full flex items-center px-2 transition-all duration-500"
          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
        >
          {count > 0 && <span className="text-xs font-semibold" style={{ color: textColor }}>{count}</span>}
        </div>
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
    </div>
  )
}

interface ChartViewProps {
  board: MockBoard
}

export function ChartView({ board }: ChartViewProps) {
  const taskMutations = useBoardStore(state => state.taskMutations)
  const apiTasks = useBoardStore(state => state.apiTasks)
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const allTasks = apiTasks.filter(t => t.boardId === board.id)

  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byGroup: Record<string, number> = {}

  for (const task of allTasks) {
    const status = taskMutations[task.id]?.status ?? task.status
    const priority = taskMutations[task.id]?.priority ?? task.priority
    const group = board.groups.find(g => g.id === task.groupId)?.name ?? 'Sin grupo'
    byStatus[status] = (byStatus[status] ?? 0) + 1
    byPriority[priority] = (byPriority[priority] ?? 0) + 1
    byGroup[group] = (byGroup[group] ?? 0) + 1
  }

  const maxStatus = Math.max(...workspaceStatuses.map(s => byStatus[s.slug] ?? 0), 1)
  const maxPriority = Math.max(...PRIORITIES.map(p => byPriority[p] ?? 0), 1)
  const groupEntries = Object.entries(byGroup).sort((a, b) => b[1] - a[1])
  const maxGroup = Math.max(...groupEntries.map(([, v]) => v), 1)

  const total = allTasks.length
  const completed = allTasks.filter(t => (taskMutations[t.id]?.status ?? t.status) === 'Completado').length
  const blocked = allTasks.filter(t => (taskMutations[t.id]?.status ?? t.status) === 'Bloqueado').length
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="flex-1 overflow-auto px-6 py-6 space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total tareas',   value: total,              color: 'text-gray-800' },
          { label: 'Completadas',    value: completed,           color: 'text-green-600' },
          { label: 'Bloqueadas',     value: blocked,             color: 'text-red-600' },
          { label: '% Avance',       value: `${completedPct}%`, color: 'text-primary-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-400 font-medium">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Progress ring */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Progreso general</p>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#00c875" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${completedPct} ${100 - completedPct}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800">{completedPct}%</span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600"><span className="font-semibold text-green-600">{completed}</span> completadas</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{total - completed}</span> pendientes</p>
            {blocked > 0 && <p className="text-red-500 font-medium">{blocked} bloqueadas — requieren atención</p>}
          </div>
        </div>
      </div>

      {/* By status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Tareas por estado</p>
        <div className="space-y-2">
          {workspaceStatuses.map(s => {
            const info = getStatusInfo(s.slug, workspaceStatuses)
            return <Bar key={s.slug} label={info.label} count={byStatus[s.slug] ?? 0} max={maxStatus} color={info.bg} textColor={info.text} />
          })}
        </div>
      </div>

      {/* By priority */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Tareas por prioridad</p>
        <div className="space-y-2">
          {PRIORITIES.map(p => {
            const style = getPriorityStyle(p)
            return <Bar key={p} label={p} count={byPriority[p] ?? 0} max={maxPriority} color={style.bg} textColor={style.text} />
          })}
        </div>
      </div>

      {/* By group */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Tareas por grupo</p>
        <div className="space-y-2">
          {groupEntries.map(([name, count]) => {
            const color = board.groups.find(g => g.name === name)?.color ?? '#94a3b8'
            return <Bar key={name} label={name} count={count} max={maxGroup} color={color} textColor="#fff" />
          })}
        </div>
      </div>
    </div>
  )
}
