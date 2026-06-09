import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageSquare, CheckSquare, Square, Plus, UserMinus } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { MockTask, PriorityType } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { AssigneeAvatar, AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { getCommentsByTaskId } from '@/data/mockComments'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { api } from '@/lib/api'

const PRIORITIES: PriorityType[] = ['Crítica', 'Alta', 'Media', 'Baja', 'Siempre activo']

const PRIORITY_TO_API: Record<PriorityType, string> = {
  'Baja': 'Baja', 'Media': 'Media', 'Alta': 'Alta', 'Crítica': 'Critica', 'Siempre activo': 'AlwaysOn',
}

interface TaskRowProps {
  task: MockTask
}

type DropdownType = 'status' | 'priority' | 'assignee' | null

export function TaskRow({ task }: TaskRowProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSelected = searchParams.get('task') === task.id

  const mutation = useBoardStore(state => state.taskMutations[task.id] ?? {})
  const updateTask = useBoardStore(state => state.updateTask)
  const comments = useBoardStore(state => state.comments)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const { isColumnVisible } = useFilterStore()

  const currentStatus = mutation.status ?? task.status
  const currentPriority = mutation.priority ?? task.priority
  const currentAssigneeIds = mutation.assigneeIds ?? task.assigneeIds
  const currentDeadline = mutation.deadline !== undefined ? mutation.deadline : task.deadline
  const commentCount = comments.filter(c => c.taskId === task.id).length || getCommentsByTaskId(task.id).length
  const isCompleted = currentStatus === 'Completado'

  const [openDropdown, setOpenDropdown] = useState<DropdownType>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
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
      onClick={handleRowClick}
      className={`group border-b border-gray-100 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : isCompleted ? 'bg-gray-50/50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Checkbox */}
      <td className="w-8 px-2 py-0" onClick={handleCheck}>
        {isCompleted
          ? <CheckSquare className="w-4 h-4 text-green-500 cursor-pointer" />
          : <Square className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" />
        }
      </td>

      {/* Title */}
      <td className="py-2 px-3 min-w-[280px]">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate max-w-xs ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </span>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-gray-400 shrink-0">
              <MessageSquare className="w-3 h-3" />
              <span className="text-xs">{commentCount}</span>
            </span>
          )}
        </div>
      </td>

      {/* Responsable */}
      {isColumnVisible('Responsable') && (
        <td className="py-1 px-2 w-28" onClick={e => toggleDropdown(e, 'assignee')}>
          <div className="flex items-center gap-1 min-h-[28px] cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors">
            {currentAssigneeIds.length > 0
              ? <AssigneeAvatarGroup userIds={currentAssigneeIds} max={3} />
              : <Plus className="w-3.5 h-3.5 text-gray-300" />
            }
          </div>
        </td>
      )}

      {/* Estado */}
      {isColumnVisible('Estado') && (
        <td className="py-1 px-1 w-32" onClick={e => toggleDropdown(e, 'status')}>
          <div className="cursor-pointer hover:opacity-80 transition-opacity">
            <StatusBadge status={currentStatus} />
          </div>
        </td>
      )}

      {/* Prioridad */}
      {isColumnVisible('Prioridad') && (
        <td className="py-1 px-1 w-28" onClick={e => toggleDropdown(e, 'priority')}>
          <div className="cursor-pointer hover:opacity-80 transition-opacity">
            <PriorityBadge priority={currentPriority} />
          </div>
        </td>
      )}

      {isColumnVisible('Fecha límite') && (
        <td className="py-2 px-3 w-32">
          <DeadlineCell deadline={currentDeadline} />
        </td>
      )}

      {isColumnVisible('Archivo') && (
        <td className="py-2 px-3 w-24">
          <span className="text-gray-300 text-xs">—</span>
        </td>
      )}

      {isColumnVisible('Texto') && (
        <td className="py-2 px-3 min-w-[160px]">
          {(mutation.description ?? task.description)
            ? <span className="text-xs text-gray-500 truncate block max-w-xs">{mutation.description ?? task.description}</span>
            : <span className="text-gray-300 text-xs">—</span>
          }
        </td>
      )}

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
    </tr>
  )
}
