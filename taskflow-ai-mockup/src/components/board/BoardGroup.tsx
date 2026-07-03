import { ChevronDown, ChevronRight, Plus, Check, X, MoreHorizontal, Pencil, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { MockGroup, MockTask } from '@/types'
import { TaskRow } from './TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { AssigneeAvatarGroup } from '@/components/ui/AssigneeAvatar'
import { DeadlineCell } from '@/components/ui/DeadlineCell'
import { useUIStore } from '@/store/uiStore'
import { useFilterStore, DEFAULT_WIDTHS } from '@/store/filterStore'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'

const DONE_STATUSES = new Set(['Completado', 'AlwaysOn'])

function TaskMobileCard({ task }: { task: MockTask }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  function handleClick() {
    const params = new URLSearchParams(searchParams)
    params.set('task', task.id)
    navigate('?' + params.toString())
  }
  return (
    <div
      onClick={handleClick}
      className="flex items-start gap-3 p-3 bg-white border-b border-gray-100 active:bg-gray-50 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.uenName && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: task.uenColor ?? '#6366f1' }}
            >
              {task.uenName}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {task.assigneeIds.length > 0 && <AssigneeAvatarGroup userIds={task.assigneeIds} max={2} />}
        {task.deadline && <DeadlineCell deadline={task.deadline} />}
      </div>
    </div>
  )
}

interface BoardGroupProps {
  group: MockGroup
  tasks: MockTask[]
  label?: string
  onAddTask?: (title: string, deadline: string | null) => void
  isDragging?: boolean
  isOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

export function BoardGroup({ group, tasks, label, onAddTask, isDragging, isOver, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop }: BoardGroupProps) {
  const { toggleGroup, isGroupCollapsed } = useUIStore()
  const { isColumnVisible, columnOrder, setColumnOrder, columnWidths, setColumnWidth } = useFilterStore()
  const { removeGroup, patchGroup, patchApiTask, setPendingMove, clearPendingMove, apiTasks } = useBoardStore()
  const collapsed = isGroupCollapsed(group.id)
  const displayName = label ?? group.name
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeTasks = tasks.filter(t => !DONE_STATUSES.has(t.status))
  const completedTasks = tasks.filter(t => DONE_STATUSES.has(t.status))
  const visibleTasks = showCompleted ? tasks : activeTasks

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [overTaskId, setOverTaskId] = useState<string | null>(null)
  const taskDragCounter = useRef<Record<string, number>>({})
  const [isGroupDragOver, setIsGroupDragOver] = useState(false)
  const groupDragCounter = useRef(0)

  function hasTaskDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).some(t => t.toLowerCase() === 'taskid')
  }

  function handleTaskDragStart(e: React.DragEvent, taskId: string) {
    e.stopPropagation()
    setDraggingTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', taskId)
  }

  function handleTaskDragEnd() {
    setDraggingTaskId(null)
    setOverTaskId(null)
    taskDragCounter.current = {}
    setIsGroupDragOver(false)
    groupDragCounter.current = 0
  }

  function handleTaskDragEnter(e: React.DragEvent, taskId: string) {
    e.preventDefault()
    taskDragCounter.current[taskId] = (taskDragCounter.current[taskId] ?? 0) + 1
    setOverTaskId(taskId)
  }

  function handleTaskDragLeave(e: React.DragEvent, taskId: string) {
    e.preventDefault()
    taskDragCounter.current[taskId] = (taskDragCounter.current[taskId] ?? 1) - 1
    if ((taskDragCounter.current[taskId] ?? 0) <= 0) {
      taskDragCounter.current[taskId] = 0
      setOverTaskId(prev => prev === taskId ? null : prev)
    }
  }

  function handleTaskDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleTaskDrop(e: React.DragEvent, targetTaskId: string) {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = e.dataTransfer.getData('taskId') || draggingTaskId
    if (!sourceId || sourceId === targetTaskId) { handleTaskDragEnd(); return }

    const fromIdx = visibleTasks.findIndex(t => t.id === sourceId)
    const toIdx = visibleTasks.findIndex(t => t.id === targetTaskId)

    if (fromIdx === -1 && toIdx !== -1) {
      const prevGroupId = apiTasks.find(t => t.id === sourceId)?.groupId ?? ''
      setPendingMove(sourceId, group.id)
      patchApiTask(sourceId, { groupId: group.id })
      api.tasks.move(sourceId, group.id)
        .catch(() => { patchApiTask(sourceId, { groupId: prevGroupId }) })
        .finally(() => { clearPendingMove(sourceId) })
      handleTaskDragEnd()
      return
    }

    if (fromIdx === -1 || toIdx === -1) { handleTaskDragEnd(); return }

    const snapshot = visibleTasks.map(t => ({ id: t.id, order: t.order }))
    const reordered = [...visibleTasks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    reordered.forEach((t, i) => patchApiTask(t.id, { order: i }))

    api.tasks.reorder(group.id, reordered.map(t => t.id)).catch(() => {
      snapshot.forEach(({ id, order }) => patchApiTask(id, { order }))
    })

    handleTaskDragEnd()
  }

  function handleWrapperDragEnter(e: React.DragEvent) {
    if (!hasTaskDrag(e)) return
    e.preventDefault()
    groupDragCounter.current++
    setIsGroupDragOver(true)
  }

  function handleWrapperDragLeave(e: React.DragEvent) {
    if (!hasTaskDrag(e)) return
    groupDragCounter.current--
    if (groupDragCounter.current <= 0) {
      groupDragCounter.current = 0
      setIsGroupDragOver(false)
    }
  }

  function handleWrapperDragOver(e: React.DragEvent) {
    if (!hasTaskDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleWrapperDrop(e: React.DragEvent) {
    setIsGroupDragOver(false)
    groupDragCounter.current = 0
    const sourceId = e.dataTransfer.getData('taskId')
    if (!sourceId) return
    e.preventDefault()
    const fromIdx = visibleTasks.findIndex(t => t.id === sourceId)
    if (fromIdx !== -1) return
    const prevGroupId = apiTasks.find(t => t.id === sourceId)?.groupId ?? ''
    setPendingMove(sourceId, group.id)
    patchApiTask(sourceId, { groupId: group.id })
    api.tasks.move(sourceId, group.id)
      .catch(() => { patchApiTask(sourceId, { groupId: prevGroupId }) })
      .finally(() => { clearPendingMove(sourceId) })
    handleTaskDragEnd()
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])

  function startEdit() {
    setMenuOpen(false)
    setNameDraft(group.name)
    setEditingName(true)
  }

  async function commitNameEdit() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === group.name) { setEditingName(false); return }
    try {
      await api.groups.update(group.id, { name: trimmed })
      patchGroup(group.id, { name: trimmed })
      toast('Grupo actualizado.', 'success')
    } catch {
      toast('Error al renombrar el grupo.', 'error')
    }
    setEditingName(false)
  }

  async function handleDelete() {
    try {
      await api.groups.delete(group.id)
      removeGroup(group.id)
      toast('Grupo eliminado.', 'success')
    } catch {
      toast('Error al eliminar el grupo.', 'error')
    }
    setConfirmDelete(false)
  }

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  function commitAdd() {
    if (!newTitle.trim()) return
    onAddTask?.(newTitle.trim(), newDeadline || null)
    setNewTitle('')
    setNewDeadline('')
    setAdding(false)
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitAdd()
    if (e.key === 'Escape') { setNewTitle(''); setNewDeadline(''); setAdding(false) }
  }

  const colDragRef = useRef<string | null>(null)
  const orderedVisible = columnOrder.filter(col => isColumnVisible(col))
  const colSpan = 2 + orderedVisible.length

  function startResize(e: React.MouseEvent, col: string) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = columnWidths[col] ?? DEFAULT_WIDTHS[col] ?? 112
    function onMove(ev: MouseEvent) {
      setColumnWidth(col, Math.max(60, startW + ev.clientX - startX))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function handleColDragStart(e: React.DragEvent, col: string) {
    e.stopPropagation()
    colDragRef.current = col
    e.dataTransfer.setData('colName', col)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleColDrop(e: React.DragEvent, targetCol: string) {
    e.preventDefault()
    e.stopPropagation()
    const srcCol = e.dataTransfer.getData('colName') || colDragRef.current
    if (!srcCol || srcCol === targetCol) return
    const next = [...columnOrder]
    const fromIdx = next.indexOf(srcCol)
    const toIdx = next.indexOf(targetCol)
    if (fromIdx === -1 || toIdx === -1) return
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, srcCol)
    setColumnOrder(next)
    colDragRef.current = null
  }

  return (
    <div
      className={`mb-6 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'} ${isOver ? 'border-t-2 border-blue-400 pt-0.5' : ''}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-1 mb-1 px-2 py-1 select-none group/header">
        {onDragStart && (
          <span className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        )}
        <button
          onClick={() => toggleGroup(group.id)}
          className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNameEdit()
                if (e.key === 'Escape') setEditingName(false)
              }}
              onBlur={commitNameEdit}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold border border-blue-400 rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ color: group.color, minWidth: '100px' }}
            />
          ) : (
            <span className="text-sm font-semibold" style={{ color: group.color }}>{displayName}</span>
          )}
          <span className="text-xs text-gray-400 ml-1">({tasks.length})</span>
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-500">¿Eliminar?</span>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-0.5 rounded hover:bg-gray-100 text-gray-500">No</button>
            <button onClick={handleDelete} className="text-xs px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white">Sí</button>
          </div>
        ) : (
          <div ref={menuRef} className="relative opacity-0 group-hover/header:opacity-100 transition-opacity ml-1">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-6 z-20 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Renombrar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
        {/* ── Mobile card list ── */}
        <div className="block md:hidden rounded-sm border border-gray-100" style={{ borderLeft: `4px solid ${group.color}` }}>
          {adding ? (
            <div className="p-3 border-b border-gray-100 bg-blue-50/40">
              <input
                ref={inputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="Nombre del elemento..."
                className="w-full text-base text-gray-800 bg-white border border-blue-400 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
              />
              <div className="flex gap-2">
                <button onClick={commitAdd} disabled={!newTitle.trim()} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-md transition-colors">
                  Agregar
                </button>
                <button onClick={() => { setNewTitle(''); setAdding(false) }} className="px-3 py-2 text-gray-400 hover:bg-gray-200 rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 px-4 py-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full transition-colors border-b border-gray-100"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar elemento</span>
            </button>
          )}
          {tasks.length === 0
            ? <div className="p-4"><EmptyState /></div>
            : visibleTasks.map(task => <TaskMobileCard key={task.id} task={task} />)
          }
          {completedTasks.length > 0 && (
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              {showCompleted ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
              <span>{showCompleted ? 'Ocultar' : 'Ver'} {completedTasks.length} completada{completedTasks.length !== 1 ? 's' : ''}</span>
            </button>
          )}
        </div>

        {/* ── Desktop table ── */}
        <div
          className="hidden md:block rounded-sm border border-gray-100 overflow-x-auto"
          style={{ borderLeft: `4px solid ${group.color}` }}
          onDragEnter={handleWrapperDragEnter}
          onDragLeave={handleWrapperDragLeave}
          onDragOver={handleWrapperDragOver}
          onDrop={handleWrapperDrop}
        >
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8 px-2" />
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Elemento</th>
                {orderedVisible.map(col => (
                  <th
                    key={col}
                    draggable
                    onDragStart={e => handleColDragStart(e, col)}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={e => handleColDrop(e, col)}
                    style={{ width: columnWidths[col] ?? DEFAULT_WIDTHS[col] ?? 112, position: 'relative' }}
                    className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-grab active:cursor-grabbing select-none"
                  >
                    {col === 'Fecha creación' ? 'Creado' : col}
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity"
                      onMouseDown={e => startResize(e, col)}
                      draggable={false}
                      onClick={e => e.stopPropagation()}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {adding ? (
                <tr className="border-b border-gray-100 bg-blue-50/40">
                  <td className="w-8 px-2" />
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        placeholder="Nombre del elemento..."
                        className="flex-1 text-sm text-gray-800 bg-white border border-blue-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[180px]"
                      />
                      <button
                        onClick={commitAdd}
                        disabled={!newTitle.trim()}
                        className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-md transition-colors"
                        title="Confirmar (Enter)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setNewTitle(''); setNewDeadline(''); setAdding(false) }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                        title="Cancelar (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {orderedVisible.map(col => col === 'Fecha límite' ? (
                    <td key={col} className="py-1.5 px-2" style={{ width: columnWidths[col] ?? DEFAULT_WIDTHS[col] }}>
                      <input
                        type="date"
                        value={newDeadline}
                        onChange={e => setNewDeadline(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </td>
                  ) : (
                    <td key={col} style={{ width: columnWidths[col] ?? DEFAULT_WIDTHS[col] }} />
                  ))}
                </tr>
              ) : (
                <tr className="border-b border-gray-100">
                  <td colSpan={colSpan}>
                    <button
                      onClick={() => setAdding(true)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar elemento</span>
                    </button>
                  </td>
                </tr>
              )}
              {tasks.length === 0
                ? (
                  <tr>
                    <td colSpan={colSpan}>
                      {isGroupDragOver && draggingTaskId === null
                        ? (
                          <div className="m-2 border-2 border-dashed border-blue-400 rounded-lg py-4 text-center text-xs text-blue-500 font-medium">
                            Soltar aquí
                          </div>
                        )
                        : <EmptyState />
                      }
                    </td>
                  </tr>
                )
                : visibleTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isDragging={draggingTaskId === task.id}
                      isOver={overTaskId === task.id && draggingTaskId !== task.id}
                      onDragStart={onAddTask ? e => handleTaskDragStart(e, task.id) : undefined}
                      onDragEnd={onAddTask ? handleTaskDragEnd : undefined}
                      onDragEnter={onAddTask ? e => handleTaskDragEnter(e, task.id) : undefined}
                      onDragLeave={onAddTask ? e => handleTaskDragLeave(e, task.id) : undefined}
                      onDragOver={onAddTask ? handleTaskDragOver : undefined}
                      onDrop={onAddTask ? e => handleTaskDrop(e, task.id) : undefined}
                    />
                  ))
              }
              {completedTasks.length > 0 && (
                <tr className="border-t border-gray-100">
                  <td colSpan={colSpan}>
                    <button
                      onClick={() => setShowCompleted(v => !v)}
                      className="flex items-center gap-2 px-4 py-2 w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {showCompleted ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                      <span>{showCompleted ? 'Ocultar' : 'Ver'} {completedTasks.length} completada{completedTasks.length !== 1 ? 's' : ''}</span>
                    </button>
                  </td>
                </tr>
              )}
              {isGroupDragOver && draggingTaskId === null && tasks.length > 0 && (
                <tr className="border-t border-blue-100">
                  <td colSpan={colSpan} className="px-3 py-2">
                    <div className="border-2 border-dashed border-blue-400 rounded-lg py-2 text-center text-xs text-blue-500 font-medium">
                      Soltar aquí
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex border-t border-gray-100 bg-gray-50 h-4">
            <div className="flex-1" />
            {orderedVisible.map(col => (
              <div key={col} style={{ width: columnWidths[col] ?? DEFAULT_WIDTHS[col] }} className="px-1">
                {col === 'Estado' && <div className="h-2 mt-1 rounded" style={{ backgroundColor: group.color, opacity: 0.35 }} />}
                {col === 'Prioridad' && <div className="h-2 mt-1 rounded bg-rose-400/30" />}
              </div>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
