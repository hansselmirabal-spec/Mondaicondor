import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageSquare, CheckSquare, Square, Plus, UserMinus, ArrowRightLeft, GripVertical, Check as CheckIcon, X as XIcon, Lock, Repeat } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { CustomFieldDefinition, MockTask, PriorityType } from '@/types'
import { MoveBoardModal } from '@/components/task/MoveBoardModal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { AssigneeAvatar, AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { getCommentsByTaskId } from '@/data/mockComments'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore, getDefaultColumnWidth } from '@/store/filterStore'
import { api } from '@/lib/api'
import { toMockTask } from '@/lib/adapters'
import { formatDate } from '@/lib/utils'

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

// 'cf:<definitionId>' opens the SELECT dropdown for that custom field
type DropdownType = 'status' | 'priority' | 'assignee' | 'uen' | string | null



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
  const customFieldDefinitions = useBoardStore(state => state.customFieldDefinitions)
  const { isColumnVisible, columnOrder, columnWidths } = useFilterStore()
  // Same board-scoping as BoardGroup's colSpan calc — keeps both in sync so a
  // `cf:<id>` column never renders a header without a matching cell (or vice versa).
  const orderedVisible = columnOrder.filter(col =>
    isColumnVisible(col) &&
    (!col.startsWith('cf:') || customFieldDefinitions.some(d => `cf:${d.id}` === col && d.boardId === task.boardId))
  )

  const currentStatus = mutation.status ?? task.status
  const currentPriority = mutation.priority ?? task.priority
  const currentAssigneeIds = mutation.assigneeIds ?? task.assigneeIds
  const currentDeadline = mutation.deadline !== undefined ? mutation.deadline : task.deadline
  const currentTitle = mutation.title ?? task.title
  const commentCount = comments.filter(c => c.taskId === task.id).length || getCommentsByTaskId(task.id).length
  const isCompleted = currentStatus === 'Completado'

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  function startEditTitle() {
    setTitleDraft(currentTitle)
    setEditingTitle(true)
  }

  function saveTitle() {
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === currentTitle) return
    updateTask(task.id, { title: trimmed })
    api.tasks.update(task.id, { title: trimmed }).catch(console.error)
  }

  // Custom fields (Phase 5): a single `value === null` deletes the key, any other
  // value sets it — mirrors the backend merge rule in `validateCustomFieldPatch`.
  // Only the changed key is sent to the API; the full merged object is applied
  // locally via patchApiTask so unrelated custom field values are never clobbered.
  function saveCustomField(fieldId: string, value: unknown) {
    const next = { ...(task.customFields ?? {}) }
    if (value === null) delete next[fieldId]
    else next[fieldId] = value
    patchApiTask(task.id, { customFields: next })
    api.tasks.update(task.id, { customFields: { [fieldId]: value } }).catch(console.error)
  }

  const [editingCfId, setEditingCfId] = useState<string | null>(null)
  const [cfDraft, setCfDraft] = useState('')

  function startEditCf(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation()
    if (editingCfId === fieldId) return
    const current = task.customFields?.[fieldId]
    setCfDraft(current == null ? '' : String(current))
    setEditingCfId(fieldId)
  }

  function commitCfEdit(field: CustomFieldDefinition) {
    setEditingCfId(null)
    const raw = cfDraft.trim()
    if (field.type === 'NUMBER') {
      if (raw === '') { saveCustomField(field.id, null); return }
      const n = Number(raw)
      if (!Number.isFinite(n)) return // invalid input — discard silently, keep previous value
      saveCustomField(field.id, n)
      return
    }
    saveCustomField(field.id, raw === '' ? null : raw)
  }

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
    // A recurring task doesn't come back as "Completado" — the backend resets
    // status to the workspace default and advances the deadline in the same
    // response. Apply that response back onto the mutation overlay instead of
    // trusting the pre-request optimistic value, or the row would keep showing
    // "Completado" with the stale deadline until a full refetch.
    api.tasks.update(task.id, { status: next })
      .then(({ task: updated }) => {
        const mock = toMockTask(updated)
        updateTask(task.id, { status: mock.status, deadline: mock.deadline })
      })
      .catch(console.error)
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

  function renderCustomFieldReadOnly(field: CustomFieldDefinition, value: unknown) {
    switch (field.type) {
      case 'CHECKBOX':
        return value === true
          ? <CheckIcon className="w-3.5 h-3.5 text-gray-400" />
          : <XIcon className="w-3.5 h-3.5 text-gray-300" />
      case 'SELECT': {
        const opt = typeof value === 'string' ? (field.config.options ?? []).find(o => o.id === value) : undefined
        return opt
          ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white opacity-70" style={{ backgroundColor: opt.color }} title="Campo archivado — solo lectura">{opt.label}</span>
          : <span className="text-gray-300 text-xs">—</span>
      }
      case 'DATE':
        return typeof value === 'string'
          ? <span className="text-xs text-gray-400" title="Campo archivado — solo lectura">{formatDate(value)}</span>
          : <span className="text-gray-300 text-xs">—</span>
      default:
        return <span className="text-xs text-gray-400" title="Campo archivado — solo lectura">{String(value)}</span>
    }
  }

  // Custom field cell dispatch by type. Archived definitions (Phase 2c contract):
  // no value → nothing renders (not a fresh column for tasks that never had it);
  // has a value → read-only, no click handlers, regardless of type.
  function renderCustomFieldCell(field: CustomFieldDefinition, w: number) {
    const col = `cf:${field.id}`
    const value = task.customFields?.[field.id]
    const hasValue = value !== undefined && value !== null

    if (field.archivedAt) {
      return (
        <td key={col} className="py-2 px-3" style={{ width: w }}>
          {hasValue ? renderCustomFieldReadOnly(field, value) : null}
        </td>
      )
    }

    switch (field.type) {
      case 'CHECKBOX': {
        const checked = value === true
        return (
          <td key={col} className="py-1 px-3" style={{ width: w }} onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => saveCustomField(field.id, !checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-400 cursor-pointer"
            />
          </td>
        )
      }
      case 'DATE': {
        const dateValue = typeof value === 'string' ? value : ''
        return (
          <td key={col} className="py-1.5 px-2" style={{ width: w }} onClick={e => e.stopPropagation()}>
            <input
              type="date"
              value={dateValue}
              onChange={e => saveCustomField(field.id, e.target.value || null)}
              className="w-full text-xs text-gray-700 bg-transparent border border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none rounded px-1 py-0.5"
            />
          </td>
        )
      }
      case 'SELECT': {
        const options = field.config.options ?? []
        const selected = typeof value === 'string' ? options.find(o => o.id === value) : undefined
        return (
          <td key={col} className="py-1 px-2" style={{ width: w }} onClick={e => toggleDropdown(e, col)}>
            <div className="flex items-center min-h-[28px] cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors">
              {selected
                ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white truncate max-w-full" style={{ backgroundColor: selected.color }}>{selected.label}</span>
                : <Plus className="w-3.5 h-3.5 text-gray-300" />
              }
            </div>
          </td>
        )
      }
      case 'TEXT':
      case 'NUMBER':
      default: {
        const isEditing = editingCfId === field.id
        if (isEditing) {
          return (
            <td key={col} className="py-1 px-2" style={{ width: w }} onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                type={field.type === 'NUMBER' ? 'number' : 'text'}
                value={cfDraft}
                onChange={e => setCfDraft(e.target.value)}
                onBlur={() => commitCfEdit(field)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitCfEdit(field) }
                  if (e.key === 'Escape') setEditingCfId(null)
                }}
                className="w-full text-xs text-gray-700 bg-white border border-primary-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </td>
          )
        }
        return (
          <td key={col} className="py-2 px-3 cursor-text" style={{ width: w }} onClick={e => startEditCf(e, field.id)}>
            {hasValue
              ? <span className="text-xs text-gray-700 truncate block">{String(value)}</span>
              : <Plus className="w-3.5 h-3.5 text-gray-300" />
            }
          </td>
        )
      }
    }
  }

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
      } ${isOver ? 'border-t-2 border-primary-400' : ''} ${
        isSelected ? 'bg-primary-50' : isCompleted ? 'bg-gray-50/50' : 'hover:bg-gray-50'
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
      <td className="py-2 px-3 min-w-[280px] align-top">
        <div className="flex items-start gap-2">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              className="text-sm flex-1 min-w-0 px-1.5 py-0.5 -my-0.5 border border-primary-400 rounded focus:outline-none focus:ring-1 focus:ring-primary-400 text-gray-800"
            />
          ) : (
            <span
              onDoubleClick={e => { e.stopPropagation(); startEditTitle() }}
              title="Doble clic para editar"
              className={`text-sm whitespace-normal break-words ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}
            >
              {currentTitle}
            </span>
          )}
          {task.isPrivate && (
            <span title="Tarea privada" className="mt-0.5 text-gray-400 shrink-0">
              <Lock className="w-3 h-3" />
            </span>
          )}
          {task.recurrenceRule && (
            <span title="Tarea recurrente" className="mt-0.5 text-gray-400 shrink-0">
              <Repeat className="w-3 h-3" />
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowMoveModal(true) }}
            title="Mover a otro tablero"
            className="p-0.5 mt-0.5 text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
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
        const w = columnWidths[col] ?? getDefaultColumnWidth(col)
        if (col.startsWith('cf:')) {
          const field = customFieldDefinitions.find(d => `cf:${d.id}` === col && d.boardId === task.boardId)
          if (!field) return <td key={col} style={{ width: w }} />
          return renderCustomFieldCell(field, w)
        }
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
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-48 max-h-64 overflow-y-auto"
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
                  <button key={u.id} onClick={e => addAssignee(e, u.id)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary-50 transition-colors">
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
                className={`w-full px-2 py-1.5 text-left hover:bg-gray-50 transition-colors ${s.slug === currentStatus ? 'bg-primary-50' : ''}`}
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
                className={`w-full px-2 py-1.5 text-left hover:bg-gray-50 transition-colors ${p === currentPriority ? 'bg-primary-50' : ''}`}
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
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${active ? 'ring-2 ring-offset-1 ring-primary-400' : ''}`}
                    style={{ backgroundColor: u.color }}
                  />
                  <span className="text-xs text-gray-700 flex-1 text-left">{u.name}</span>
                  {active && <span className="text-[10px] text-primary-500 font-semibold">✓</span>}
                </button>
              )
            })}
          </div>
        </td>
      )}
      {openDropdown?.startsWith('cf:') && (() => {
        const fieldId = openDropdown.slice(3)
        const field = customFieldDefinitions.find(d => d.id === fieldId && d.boardId === task.boardId)
        if (!field || field.type !== 'SELECT') return null
        const options = (field.config.options ?? []).filter(o => !o.archivedAt)
        const currentValue = task.customFields?.[fieldId]
        return (
          <td className="p-0 border-0">
            <div
              ref={dropdownRef}
              className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl w-44 max-h-64 overflow-y-auto"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1.5 border-b border-gray-100">{field.label}</p>
              <button
                onClick={() => { saveCustomField(field.id, null); setOpenDropdown(null) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-xs text-gray-400 italic">Sin valor</span>
              </button>
              {options.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2 italic">Sin opciones configuradas</p>
              )}
              {options.map(o => (
                <button
                  key={o.id}
                  onClick={() => { saveCustomField(field.id, o.id); setOpenDropdown(null) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-sm shrink-0 ${currentValue === o.id ? 'ring-2 ring-offset-1 ring-primary-400' : ''}`}
                    style={{ backgroundColor: o.color }}
                  />
                  <span className="text-xs text-gray-700 flex-1 text-left truncate">{o.label}</span>
                  {currentValue === o.id && <span className="text-[10px] text-primary-500 font-semibold">✓</span>}
                </button>
              ))}
            </div>
          </td>
        )
      })()}
      {showMoveModal && (
        <td className="p-0 border-0">
          <MoveBoardModal
            taskId={task.id}
            taskTitle={task.title}
            currentBoardId={task.boardId}
            customFields={task.customFields}
            onClose={() => setShowMoveModal(false)}
            onMoved={() => { setShowMoveModal(false); navigate('/boards') }}
          />
        </td>
      )}
    </tr>
  )
}
