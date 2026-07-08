import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageSquare, CheckSquare, Square, Plus, UserMinus, ArrowRightLeft, GripVertical } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { MockTask, PriorityType } from '@/types'
import { MoveBoardModal } from '@/components/task/MoveBoardModal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { AssigneeAvatar, AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { getCommentsByTaskId } from '@/data/mockComments'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore, DEFAULT_WIDTHS } from '@/store/filterStore'
import { api } from '@/lib/api'

const PRIORITIES: PriorityType[] = ['Crítica', 'Alta', 'Media', 'Baja', 'Siempre activo']

const PRIORITY_TO_API: Record<PriorityType, string> = {
  'Baja': 'Baja', 'Media': 'Media', 'Alta': 'Alta', 'Crítica': 'Critica', 'Siempre activo': 'AlwaysOn',
}

interface TaskRowProps {
  task: MockTask
  isDragging?: boolean
  isOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

type DropdownType = 'status' | 'priority' | 'assignee' | 'uen' | null



export function TaskRow({ task, isDragging, isOver, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop }: TaskRowProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSelected = searchParams.get('task') === task.id

  const mutation = useBoardStore(state => state.taskMutations[task.id] ?? {})
  const updateTask = useBoardStore(state => state.updateTask)
  const patchApiTask = useBoardStore(state => state.patchApiTask)
  const comments = useBoardStore(state => state.comments)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const workspaceUens = useBoardStore(state => state.workspaceUens)
  const boards = useBoardStore(state => state.boards)
  const taskOrigins = useBoardStore(state => state.taskOrigins)
  const { isColumnVisible, columnOrder, columnWidths } = useFilterStore()
  const orderedVisible = columnOrder.filter(col => isColumnVisible(col))

  const currentStatus = mutation.status ?? task.status
  const currentPriority = mutation.priority ?? task.priority
  const currentAssigneeIds = mutation.assigneeIds ?? task.assigneeIds
  const currentDeadline = mutation.deadline !== undefined ? mutation.deadline : task.deadline
  const commentCount = comments.filter(c => c.taskId === task.id).length || getCommentsByTaskId(task.id).length
  const isCompleted = currentStatus === 'Completado'

  const [openDropdown, setOpenDropdown] = useState<DropdownType>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [showMoveModal, setShowMoveModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openDropdown) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDropdown])

  function handleRowClick() {
    const params = new URLSearchParams(searchParams)
    params.set('task', task.id)
    params.delete('panel')
    navigate('?' + params.toString())
  }

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    const next = isCompleted ? 'Asignado' : 'Completado'
    updateTask(task.id, { status: next })
    api.tasks.update(task.id, { status: next }).catch(console.error)
  }

  function toggleDropdown(e: React.MouseEvent, name: DropdownType) {
    e.stopPropagation()
    if (openDropdown === name) { setOpenDropdown(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    setOpenDropdown(name)
  }

  function changeStatus(e: React.MouseEvent, slug: string) {
    e.stopPropagation()
    updateTask(task.id, { status: slug })
    api.tasks.update(task.id, { status: slug }).catch(console.error)
    setOpenDropdown(null)
  }

  function changePriority(e: React.MouseEvent, p: PriorityType) {
    e.stopPropagation()
    updateTask(task.id, { priority: p })
    api.tasks.update(task.id, { priority: PRIORITY_TO_API[p] }).catch(console.error)
    setOpenDropdown(null)
  }

  function addAssignee(e: React.MouseEvent, userId: string) {
    e.stopPropagation()
    const newIds = [...currentAssigneeIds, userId]
    updateTask(task.id, { assigneeIds: newIds })
    api.tasks.update(task.id, { assigneeIds: newIds }).catch(console.error)
    setOpenDropdown(null)
  }

  function removeAssignee(e: React.MouseEvent, userId: string) {
    e.stopPropagation()
    const newIds = currentAssigneeIds.filter(id => id !== userId)
    updateTask(task.id, { assigneeIds: newIds })
    api.tasks.update(task.id, { assigneeIds: newIds }).catch(console.error)
  }

  const availableUsers = apiUsers.filter(u => !currentAssigneeIds.includes(u.id))

  return (
    <tr
      onClick={isDragging ? undefined : handleRowClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group border-b border-gray-100 cursor-pointer transition-all ${
        isDragging ? 'opacity-40' : ''
      } ${isOver ? 'border-t-2 border-blue-400' : ''} ${
        isSelected ? 'bg-blue-50' : isCompleted ? 'bg-gray-50/50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Checkbox / drag handle */}
      <td className="w-8 px-2 py-0" onClick={handleCheck}>
        <div className="flex items-center gap-0.5">
          {onDragStart && (
            <GripVertical className="w-3 h-3 text-gray-200 group-hover:text-gray-400 shrink-0 cursor-grab active:cursor-grabbing transition-colors" />
          )}
          {isCompleted
            ? <CheckSquare className="w-4 h-4 text-green-500 cursor-pointer" />
            : <Square className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" />
          }
        </div>
      </td>

      {/* Title */}
      <td className="py-2 px-3 min-w-[280px]">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate max-w-xs ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setShowMoveModal(true) }}
            title="Mover a otro tablero"
            className="p-0.5 text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <ArrowRightLeft className="w-3 h-3" />
          </button>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-gray-400 shrink-0">
              <MessageSquare className="w-3 h-3" />
              <span className="text-xs">{commentCount}</span>
            </span>
          )}
        </div>
      </td>

      {orderedVisible.map(col => {
        const w = columnWidths[col] ?? DEFAULT_WIDTHS[col] ?? 112
        switch (col) {
          case 'Responsable':
            return (
              <td key={col} className="py-1 px-2" style={{ width: w }} onClick={e => toggleDropdown(e, 'assignee')}>
                <div className="flex items-center gap-1 min-h-[28px] cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors">
                  {currentAssigneeIds.length > 0
                    ? <AssigneeAvatarGroup userIds={currentAssigneeIds} max={3} />
                    : <Plus className="w-3.5 h-3.5 text-gray-300" />
                  }
                </div>
              </td>
            )
          case 'Estado':
            return (
              <td key={col} className="py-1 px-1" style={{ width: w }} onClick={e => toggleDropdown(e, 'status')}>
                <div className="cursor-pointer hover:opacity-80 transition-opacity">
                  <StatusBadge status={currentStatus} />
                </div>
              </td>
            )
          case 'Prioridad':
            return (
              <td key={col} className="py-1 px-1" style={{ width: w }} onClick={e => toggleDropdown(e, 'priority')}>
                <div className="cursor-pointer hover:opacity-80 transition-opacity">
                  <PriorityBadge priority={currentPriority} />
                </div>
              </td>
            )
          case 'UEN':
            return (
              <td key={col} className="py-1 px-2" style={{ width: w }} onClick={e => toggleDropdown(e, 'uen')}>
                <div className="flex flex-wrap gap-1 min-h-[28px] cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors items-center">
                  {task.uenIds.length > 0
                    ? task.uenIds.map(uid => {
                        const uen = workspaceUens.find(u => u.id === uid)
                        return uen ? (
                          <span
                            key={uid}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: uen.color }}
                          >
                            {uen.name}
                          </span>
                        ) : null
                      })
                    : <Plus className="w-3.5 h-3.5 text-gray-300" />
                  }
                </div>
              </td>
            )
          case 'Fecha límite':
            return (
              <td key={col} className="py-2 px-3" style={{ width: w }}>
                <DeadlineCell deadline={currentDeadline} />
              </td>
            )
          case 'Archivo':
            return (
              <td key={col} className="py-2 px-3" style={{ width: w }}>
                <span className="text-gray-300 text-xs">—</span>
              </td>
            )
          case 'Texto':
            return (
              <td key={col} className="py-2 px-3" style={{ width: w }}>
                {(mutation.description ?? task.description)
                  ? <span className="text-xs text-gray-500 truncate block max-w-xs">{mutation.description ?? task.description}</span>
                  : <span className="text-gray-300 text-xs">—</span>
                }
              </td>
            )
          case 'Fecha creación':
            return (
              <td key={col} className="py-2 px-3" style={{ width: w }}>
                <span className="text-xs text-gray-400">
                  {new Date(task.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </td>
            )
          case 'Grupo': {
            const originGroupId = taskOrigins[task.id]
            const group = originGroupId
              ? boards.flatMap(b => b.groups).find(g => g.id === originGroupId)
              : null
            return (
              <td key={col} className="py-2 px-3" style={{ width: w }}>
                {group ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-xs text-gray-500 truncate">{group.name}</span>
                  </div>
                ) : null}
              </td>
            )
          }
          default:
            return <td key={col} style={{ width: w }} />
        }
      })}

      {/* Dropdowns fixed — escape overflow containers */}
      {openDropdown === 'assignee' && (
        <td className="p-0 border-0">
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-48 overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onClick={e => e.stopPropagation()}
          >
            {currentAssigneeIds.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1.5 border-b border-gray-100">Asignados</p>
                {currentAssigneeIds.map(id => {
                  const u = apiUsers.find(x => x.id === id)
                  return u ? (
                    <div key={id} className="flex items-center justify-between px-3 py-1.5 hover:bg-red-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <AssigneeAvatar userId={id} size="sm" />
                        <span className="text-xs text-gray-700">{u.name}</span>
                      </div>
                      <button onClick={e => removeAssignee(e, id)} className="text-red-300 hover:text-red-600 transition-colors">
                        <UserMinus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null
                })}
              </>
            )}
            {availableUsers.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1.5 border-b border-gray-100">Agregar</p>
                {availableUsers.map(u => (
                  <button key={u.id} onClick={e => addAssignee(e, u.id)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 transition-colors">
                    <AssigneeAvatar userId={u.id} size="sm" />
                    <span className="text-xs text-gray-700">{u.name}</span>
                  </button>
                ))}
              </>
            )}
            {availableUsers.length === 0 && currentAssigneeIds.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2 italic">Sin miembros disponibles</p>
            )}
          </div>
        </td>
      )}

      {openDropdown === 'status' && (
        <td className="p-0 border-0">
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-40 overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onClick={e => e.stopPropagation()}
          >
            {workspaceStatuses.map(s => (
              <button
                key={s.slug}
                onClick={e => changeStatus(e, s.slug)}
                className={`w-full px-2 py-1.5 text-left hover:bg-gray-50 transition-colors ${s.slug === currentStatus ? 'bg-blue-50' : ''}`}
              >
                <StatusBadge status={s.slug} />
              </button>
            ))}
          </div>
        </td>
      )}

      {openDropdown === 'priority' && (
        <td className="p-0 border-0">
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-36 overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onClick={e => e.stopPropagation()}
          >
            {PRIORITIES.map(p => (
              <button
                key={p}
                onClick={e => changePriority(e, p)}
                className={`w-full px-2 py-1.5 text-left hover:bg-gray-50 transition-colors ${p === currentPriority ? 'bg-blue-50' : ''}`}
              >
                <PriorityBadge priority={p} />
              </button>
            ))}
          </div>
        </td>
      )}

      {openDropdown === 'uen' && (
        <td className="p-0 border-0">
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-44 overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1.5 border-b border-gray-100">UEN</p>
            {workspaceUens.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2 italic">Sin UENs configuradas</p>
            )}
            {workspaceUens.map(u => {
              const active = task.uenIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  onClick={e => {
                    e.stopPropagation()
                    const newIds = active ? task.uenIds.filter(id => id !== u.id) : [...task.uenIds, u.id]
                    patchApiTask(task.id, { uenIds: newIds })
                    api.tasks.update(task.id, { uenIds: newIds }).catch(console.error)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${active ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                    style={{ backgroundColor: u.color }}
                  />
                  <span className="text-xs text-gray-700 flex-1 text-left">{u.name}</span>
                  {active && <span className="text-[10px] text-blue-500 font-semibold">✓</span>}
                </button>
              )
            })}
          </div>
        </td>
      )}
      {showMoveModal && (
        <td className="p-0 border-0">
          <MoveBoardModal
            taskId={task.id}
            taskTitle={task.title}
            currentBoardId={task.boardId}
            onClose={() => setShowMoveModal(false)}
            onMoved={() => { setShowMoveModal(false); navigate('/boards') }}
          />
        </td>
      )}
    </tr>
  )
}
