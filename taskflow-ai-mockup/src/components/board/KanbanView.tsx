import type { MockBoard, MockTask } from '@/types'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface KanbanCardProps {
  task: MockTask
}

function KanbanCard({ task }: KanbanCardProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mutation = useBoardStore(state => state.taskMutations[task.id] ?? {})
  const status = mutation.status ?? task.status

  function open() {
    const params = new URLSearchParams(searchParams)
    params.set('task', task.id)
    params.delete('panel')
    navigate('?' + params.toString())
  }

  return (
    <div
      onClick={open}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-medium text-gray-900 mb-2 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <AssigneeAvatarGroup userIds={task.assigneeIds} max={2} />
        <DeadlineCell deadline={task.deadline} />
      </div>
      <div className="mt-2">
        <StatusBadge status={status} />
      </div>
    </div>
  )
}

interface KanbanViewProps {
  board: MockBoard
}

export function KanbanView({ board }: KanbanViewProps) {
  const { searchQuery, selectedPersonaId, filterStatus, filterPriority } = useFilterStore()
  const taskMutations = useBoardStore(state => state.taskMutations)
  const apiTasks = useBoardStore(state => state.apiTasks)
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const allTasks = apiTasks.filter(t => t.boardId === board.id)

  function getEffectiveStatus(task: MockTask): string {
    return taskMutations[task.id]?.status ?? task.status
  }

  const filtered = allTasks.filter(task => {
    const effectiveStatus = getEffectiveStatus(task)
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (selectedPersonaId && !task.assigneeIds.includes(selectedPersonaId)) return false
    if (filterStatus && effectiveStatus !== filterStatus) return false
    if (filterPriority && (taskMutations[task.id]?.priority ?? task.priority) !== filterPriority) return false
    return true
  })

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full scrollbar-thin">
      {workspaceStatuses.map(col => {
        const colTasks = filtered.filter(t => getEffectiveStatus(t) === col.slug)
        return (
          <div key={col.slug} className="flex flex-col shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span className="text-xs text-gray-400 ml-auto bg-gray-100 rounded-full px-2 py-0.5">{colTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {colTasks.map(task => <KanbanCard key={task.id} task={task} />)}
              {colTasks.length === 0 && (
                <div className="border-2 border-dashed border-gray-100 rounded-lg h-20 flex items-center justify-center">
                  <span className="text-xs text-gray-300">Sin tareas</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
