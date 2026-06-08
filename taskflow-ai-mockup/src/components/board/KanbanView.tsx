import { useState, useRef } from 'react'
import type { MockBoard, MockTask } from '@/types'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'

interface KanbanCardProps {
  task: MockTask
  isDragging: boolean
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragEnd: () => void
}

function KanbanCard({ task, isDragging, onDragStart, onDragEnd }: KanbanCardProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mutation = useBoardStore(state => state.taskMutations[task.id] ?? {})
  const priority = mutation.priority ?? task.priority

  function open(e: React.MouseEvent) {
    if (isDragging) return
    const params = new URLSearchParams(searchParams)
    params.set('task', task.id)
    params.delete('panel')
    navigate('?' + params.toString())
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={open}
      className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none transition-all ${
        isDragging
          ? 'border-blue-400 shadow-lg opacity-50 rotate-1 scale-95'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <p className="text-sm font-medium text-gray-900 mb-2.5 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <AssigneeAvatarGroup userIds={task.assigneeIds} max={2} />
        <DeadlineCell deadline={task.deadline} />
      </div>
      {priority && priority !== 'Media' && (
        <div className="mt-2">
          <PriorityBadge priority={priority} />
        </div>
      )}
    </div>
  )
}

interface KanbanViewProps {
  board: MockBoard
}

export function KanbanView({ board }: KanbanViewProps) {
  const { searchQuery, selectedPersonaId, filterStatus, filterPriority } = useFilterStore()
  const { taskMutations, apiTasks, workspaceStatuses, updateTask } = useBoardStore(s => ({
    taskMutations: s.taskMutations,
    apiTasks: s.apiTasks,
    workspaceStatuses: s.workspaceStatuses,
    updateTask: s.updateTask,
  }))

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overSlug, setOverSlug] = useState<string | null>(null)
  const dragCounter = useRef<Record<string, number>>({})

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

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggingId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', taskId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setOverSlug(null)
    dragCounter.current = {}
  }

  function handleDragEnter(e: React.DragEvent, slug: string) {
    e.preventDefault()
    dragCounter.current[slug] = (dragCounter.current[slug] ?? 0) + 1
    setOverSlug(slug)
  }

  function handleDragLeave(e: React.DragEvent, slug: string) {
    e.preventDefault()
    dragCounter.current[slug] = (dragCounter.current[slug] ?? 1) - 1
    if (dragCounter.current[slug] <= 0) {
      dragCounter.current[slug] = 0
      setOverSlug(prev => prev === slug ? null : prev)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, slug: string) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId') || draggingId
    if (!taskId) return

    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    const currentStatus = getEffectiveStatus(task)
    if (currentStatus === slug) { handleDragEnd(); return }

    // Optimistic update
    updateTask(taskId, { status: slug })
    api.tasks.update(taskId, { status: slug }).catch(() => {
      // Revert on error
      updateTask(taskId, { status: currentStatus })
    })

    handleDragEnd()
  }

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full scrollbar-thin">
      {workspaceStatuses.map(col => {
        const colTasks = filtered.filter(t => getEffectiveStatus(t) === col.slug)
        const isOver = overSlug === col.slug && draggingId !== null

        const draggingTask = draggingId ? allTasks.find(t => t.id === draggingId) : null
        const draggingFromThisCol = draggingTask
          ? getEffectiveStatus(draggingTask) === col.slug
          : false

        return (
          <div
            key={col.slug}
            className="flex flex-col shrink-0 w-64"
            onDragEnter={e => handleDragEnter(e, col.slug)}
            onDragLeave={e => handleDragLeave(e, col.slug)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, col.slug)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span className="text-xs text-gray-400 ml-auto bg-gray-100 rounded-full px-2 py-0.5">
                {colTasks.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-xl p-2 transition-all duration-150 ${
                isOver && !draggingFromThisCol
                  ? 'bg-blue-50 border-2 border-blue-300 border-dashed'
                  : 'bg-transparent border-2 border-transparent'
              }`}
            >
              {colTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isDragging={draggingId === task.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}

              {colTasks.length === 0 && !isOver && (
                <div className="border-2 border-dashed border-gray-100 rounded-lg h-20 flex items-center justify-center">
                  <span className="text-xs text-gray-300">Sin tareas</span>
                </div>
              )}

              {isOver && !draggingFromThisCol && (
                <div className="border-2 border-dashed border-blue-300 rounded-lg h-16 flex items-center justify-center bg-blue-50/50">
                  <span className="text-xs text-blue-400 font-medium">Soltar aquí</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
