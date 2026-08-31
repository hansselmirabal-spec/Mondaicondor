import { X, Calendar, Flag, User, FileText, MessageSquare, Clock, ChevronDown, Plus, UserMinus, Pencil, History, Trash2, ArrowRightLeft, Lock, Repeat } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PriorityBadge } from '@/components/ui/PriorityBadge'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { HelpTip } from '@/components/ui/HelpTip'
import { CommentList } from './CommentList'
import { ActivityTimeline } from './ActivityTimeline'
import { formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import { toMockUser } from '@/lib/adapters'
import { useAuthStore } from '@/store/authStore'
import { MoveBoardModal } from './MoveBoardModal'
import { isBoardAdminClient } from '@/lib/permissions'
import type { StatusType, PriorityType, RecurrenceRule } from '@/types'

const STATUS_TO_API: Record<StatusType, string> = {
  'Nuevo': 'Nuevo',
  'Asignado': 'Asignado',
  'En progreso': 'EnProgreso',
  'En revisión': 'EnRevision',
  'Bloqueado': 'Bloqueado',
  'Completado': 'Completado',
  'Siempre activo': 'AlwaysOn',
}

const PRIORITY_TO_API: Record<PriorityType, string> = {
  'Baja': 'Baja',
  'Media': 'Media',
  'Alta': 'Alta',
  'Crítica': 'Critica',
  'Siempre activo': 'AlwaysOn',
}

const STATUSES: StatusType[] = ['Nuevo', 'Asignado', 'En progreso', 'En revisión', 'Bloqueado', 'Completado', 'Siempre activo']
const PRIORITIES: PriorityType[] = ['Crítica', 'Alta', 'Media', 'Baja', 'Siempre activo']

interface SelectDropdownProps<T extends string> {
  value: T
  options: T[]
  onChange: (v: T) => void
  renderBadge: (v: T) => React.ReactNode
}

function SelectDropdown<T extends string>({ value, options, onChange, renderBadge }: SelectDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded hover:ring-2 hover:ring-blue-400 transition-all"
      >
        <span className="w-28">{renderBadge(value)}</span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-36">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full px-2 py-1.5 text-left hover:bg-gray-50 transition-colors ${opt === value ? 'bg-blue-50' : ''}`}
            >
              <span className="block">{renderBadge(opt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskDetailDrawer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('task')
  const newTasks = useBoardStore(state => state.newTasks)
  const apiTasks = useBoardStore(state => state.apiTasks)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const setApiUsers = useBoardStore(state => state.setApiUsers)
  const workspaceUens = useBoardStore(state => state.workspaceUens)
  const patchApiTask = useBoardStore(state => state.patchApiTask)
  const setTaskOrigin = useBoardStore(state => state.setTaskOrigin)
  const boards = useBoardStore(state => state.boards)
  const workspaces = useBoardStore(state => state.workspaces)
  const task = taskId ? (apiTasks.find(t => t.id === taskId) ?? newTasks.find(t => t.id === taskId) ?? null) : null

  const currentUser = useAuthStore(state => state.user)
  const mutation = useBoardStore(state => task ? state.taskMutations[task.id] ?? {} : {})
  const updateTask = useBoardStore(state => state.updateTask)
  const removeTask = useBoardStore(state => state.removeTask)
  const setDeadline = useBoardStore(state => state.setDeadline)
  const deadlineHistory = useBoardStore(state => task ? (state.deadlineHistory[task.id] ?? []) : [])

  // Load workspace members if the store is empty (e.g. direct URL open or navigation from outside board)
  useEffect(() => {
    if (!task || apiUsers.length > 0) return
    const board = boards.find(b => b.id === task.boardId)
    if (!board) return
    api.workspaces.get(board.workspaceId)
      .then(({ workspace }) => setApiUsers(workspace.members.map(m => toMockUser(m.user))))
      .catch(() => {})
  }, [task?.id, apiUsers.length, boards])

  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [assigneePicker, setAssigneePicker] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState(false)
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [showDeadlineHistory, setShowDeadlineHistory] = useState(false)
  const [recurrenceIntervalDraft, setRecurrenceIntervalDraft] = useState('7')
  const [recurrenceUnitDraft, setRecurrenceUnitDraft] = useState<RecurrenceRule['unit']>('days')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assigneePicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setAssigneePicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assigneePicker])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function close() {
    const params = new URLSearchParams(searchParams)
    params.delete('task')
    navigate('?' + params.toString())
  }

  // Keep the interval/unit draft in sync with the loaded task's rule (e.g. on
  // opening the drawer, or after switching to a different task).
  useEffect(() => {
    if (task?.recurrenceRule) {
      setRecurrenceIntervalDraft(String(task.recurrenceRule.interval))
      setRecurrenceUnitDraft(task.recurrenceRule.unit)
    }
  }, [task?.id, task?.recurrenceRule])

  if (!task) return null

  const currentStatus = mutation.status ?? task.status
  const currentPriority = mutation.priority ?? task.priority
  const currentDesc = mutation.description ?? task.description
  const currentDeadline = mutation.deadline !== undefined ? mutation.deadline : task.deadline

  // Client-side mirror only — the backend re-checks creator-or-board-admin on
  // every PUT (see tasks.ts's ownership gate). This just avoids a doomed
  // network round-trip and gives better error messaging in the UI.
  const drawerBoard = boards.find(b => b.id === task.boardId)
  const canChangePrivacy = task.createdBy === currentUser?.id
    || isBoardAdminClient(drawerBoard, currentUser, workspaces)

  function togglePrivate() {
    if (!task || !canChangePrivacy) return
    const next = !task.isPrivate
    patchApiTask(task.id, { isPrivate: next })
    api.tasks.update(task.id, { isPrivate: next }).catch(() => {
      patchApiTask(task.id, { isPrivate: !next })
    })
  }

  function saveDeadline(value: string) {
    if (!task) return
    const newDeadline = value || null
    if (newDeadline === currentDeadline) return
    // Backend expects full ISO datetime; input type="date" gives "YYYY-MM-DD"
    const isoDeadline = newDeadline ? new Date(newDeadline + 'T00:00:00.000Z').toISOString() : null
    setDeadline(task.id, currentDeadline, newDeadline, currentUser?.id ?? '', currentUser?.name ?? '')
    api.tasks.update(task.id, { deadline: isoDeadline }).catch(console.error)
  }

  // Direct-patch pattern (mirrors togglePrivate above) rather than the
  // taskMutations overlay — recurrenceRule isn't part of that mutation type,
  // and this field doesn't need optimistic-then-reconciled UX beyond a revert
  // on API failure.
  function saveRecurrence(rule: RecurrenceRule | null) {
    if (!task) return
    const previous = task.recurrenceRule
    patchApiTask(task.id, { recurrenceRule: rule })
    api.tasks.update(task.id, { recurrenceRule: rule }).catch(() => {
      patchApiTask(task.id, { recurrenceRule: previous })
    })
  }

  function toggleRecurring() {
    if (!task) return
    if (task.recurrenceRule) {
      saveRecurrence(null)
      return
    }
    const interval = Math.max(1, parseInt(recurrenceIntervalDraft, 10) || 1)
    saveRecurrence({ unit: recurrenceUnitDraft, interval })
  }

  // Draft updates on every keystroke (controlled input); the actual save only
  // fires on blur/Enter, mirroring the deadline and custom-field NUMBER inputs
  // elsewhere in this drawer.
  function commitRecurrenceInterval() {
    if (!task?.recurrenceRule) return
    const interval = Math.max(1, parseInt(recurrenceIntervalDraft, 10) || 1)
    setRecurrenceIntervalDraft(String(interval))
    if (interval === task.recurrenceRule.interval) return
    saveRecurrence({ unit: task.recurrenceRule.unit, interval })
  }

  function commitRecurrenceUnit(unit: RecurrenceRule['unit']) {
    setRecurrenceUnitDraft(unit)
    if (!task?.recurrenceRule || unit === task.recurrenceRule.unit) return
    saveRecurrence({ unit, interval: task.recurrenceRule.interval })
  }

  function formatHistoryDate(iso: string) {
    return new Date(iso).toLocaleString('es-PY', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  function formatDeadlineLabel(d: string | null) {
    if (!d) return 'Sin fecha'
    return formatDate(d)
  }
  const currentUenIds = task.uenIds
  const currentAssigneeIds = mutation.assigneeIds ?? task.assigneeIds
  const availableUsers = apiUsers.filter(u => !currentAssigneeIds.includes(u.id))

  function addAssignee(userId: string) {
    if (!task) return
    const newIds = [...currentAssigneeIds, userId]
    updateTask(task.id, { assigneeIds: newIds })
    api.tasks.update(task.id, { assigneeIds: newIds }).catch(console.error)
  }

  function removeAssignee(userId: string) {
    if (!task) return
    const newIds = currentAssigneeIds.filter(id => id !== userId)
    updateTask(task.id, { assigneeIds: newIds })
    api.tasks.update(task.id, { assigneeIds: newIds }).catch(console.error)
  }

  function startEditDesc() {
    setDescDraft(currentDesc)
    setEditingDesc(true)
  }

  function saveDesc() {
    if (!task) return
    updateTask(task.id, { description: descDraft })
    setEditingDesc(false)
    api.tasks.update(task.id, { description: descDraft }).catch(console.error)
  }

  async function handleDeleteTask() {
    if (!task) return
    try {
      await api.tasks.delete(task.id)
      removeTask(task.id)
      close()
    } catch {
      // silently ignore — task is already removed optimistically
    }
  }

  return (
    <>
      <aside className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200">
          <button onClick={close} className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 leading-snug pt-0.5 flex-1">{task.title}</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={togglePrivate}
              disabled={!canChangePrivacy}
              title={
                canChangePrivacy
                  ? (task.isPrivate ? 'Tarea privada — click para hacerla pública' : 'Hacer tarea privada')
                  : 'Solo el creador o un administrador del tablero puede cambiar la privacidad'
              }
              className={`p-1.5 rounded-lg transition-colors ${
                task.isPrivate ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'
              } ${canChangePrivacy ? 'hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
            >
              <Lock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMoveModal(true)}
              title="Mover a otro tablero"
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">¿Eliminar?</span>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">No</button>
                <button onClick={handleDeleteTask} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Sí</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Eliminar tarea"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div ref={pickerRef} className="relative">
              <div className="flex items-center gap-1 mb-1.5">
                <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <User className="w-3 h-3" /> Responsables
                </p>
                <HelpTip title="Responsables">
                  <p>Solo aparecen acá las personas que ya pertenecen a este espacio de trabajo.</p>
                  <p>Si no ves a alguien en la lista, primero sumalo al espacio desde Config → Miembros y después vas a poder asignarle tareas.</p>
                </HelpTip>
              </div>
              <button
                onClick={() => setAssigneePicker(o => !o)}
                className="w-full text-left group"
              >
                <div className="flex flex-wrap gap-1 items-center min-h-[24px]">
                  {currentAssigneeIds.length === 0
                    ? <span className="text-xs text-gray-400 italic group-hover:text-blue-500 transition-colors">Sin asignar — click para agregar</span>
                    : currentAssigneeIds.map(id => {
                        const u = apiUsers.find(user => user.id === id)
                        return u ? (
                          <div key={id} className="flex items-center gap-1 bg-blue-50 rounded-full px-2 py-0.5">
                            <AssigneeAvatar userId={id} size="sm" />
                            <span className="text-xs text-gray-700">{u.name}</span>
                          </div>
                        ) : null
                      })
                  }
                  <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                </div>
              </button>
              {assigneePicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-60 overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-100">Responsables</p>

                  {apiUsers.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-2 italic">Sin miembros disponibles</p>
                  )}

                  {apiUsers.map(u => {
                    const assigned = currentAssigneeIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        onClick={() => assigned ? removeAssignee(u.id) : addAssignee(u.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${assigned ? 'bg-blue-50 hover:bg-red-50' : 'hover:bg-blue-50'}`}
                      >
                        <AssigneeAvatar userId={u.id} size="sm" />
                        <span className="text-xs text-gray-700 flex-1 text-left truncate">{u.name}</span>
                        {assigned
                          ? <UserMinus className="w-3 h-3 text-red-400 shrink-0" />
                          : <Plus className="w-3 h-3 text-blue-400 shrink-0" />
                        }
                      </button>
                    )
                  })}

                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Fecha límite
                {deadlineHistory.length > 0 && (
                  <button
                    onClick={() => setShowDeadlineHistory(o => !o)}
                    className="ml-auto flex items-center gap-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Ver historial"
                  >
                    <History className="w-3 h-3" />
                    <span className="text-[10px] font-normal">{deadlineHistory.length}</span>
                  </button>
                )}
              </p>

              {editingDeadline ? (
                <input
                  type="date"
                  autoFocus
                  value={deadlineDraft}
                  onChange={e => setDeadlineDraft(e.target.value)}
                  onBlur={e => { saveDeadline(e.target.value); setEditingDeadline(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { saveDeadline((e.target as HTMLInputElement).value); setEditingDeadline(false) }
                    if (e.key === 'Escape') setEditingDeadline(false)
                  }}
                  className="w-full text-sm border border-blue-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <button
                  onClick={() => { setDeadlineDraft(currentDeadline ?? ''); setEditingDeadline(true) }}
                  className="group flex items-center gap-2 text-sm hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors w-full"
                >
                  {currentDeadline ? (
                    <span className={`font-medium ${new Date(currentDeadline) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatDate(currentDeadline)}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">Agregar fecha límite</span>
                  )}
                  <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500 ml-auto" />
                </button>
              )}

              {/* Historial de cambios de deadline */}
              {showDeadlineHistory && deadlineHistory.length > 0 && (
                <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-1.5 border-b border-gray-100">
                    Historial de fecha límite
                  </p>
                  <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {[...deadlineHistory].reverse().map((entry, i) => (
                      <div key={i} className="px-3 py-2 text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">{entry.byName}</span>
                          <span className="text-gray-400">{formatHistoryDate(entry.at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <span className="text-gray-400 line-through">{formatDeadlineLabel(entry.from)}</span>
                          <span className="text-orange-400">→</span>
                          <span className="font-medium text-gray-700">{formatDeadlineLabel(entry.to)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <Repeat className="w-3 h-3" /> Tarea recurrente
                </p>
                <button
                  onClick={toggleRecurring}
                  role="switch"
                  aria-checked={!!task.recurrenceRule}
                  title={task.recurrenceRule ? 'Desactivar recurrencia' : 'Repetir esta tarea al completarla'}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                    task.recurrenceRule ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      task.recurrenceRule ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {task.recurrenceRule ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Cada</span>
                  <input
                    type="number"
                    min={1}
                    value={recurrenceIntervalDraft}
                    onChange={e => setRecurrenceIntervalDraft(e.target.value)}
                    onBlur={commitRecurrenceInterval}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <select
                    value={recurrenceUnitDraft}
                    onChange={e => commitRecurrenceUnit(e.target.value as RecurrenceRule['unit'])}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="days">día(s)</option>
                    <option value="weeks">semana(s)</option>
                    <option value="months">mes(es)</option>
                  </select>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Al completarla, se reprograma en vez de cerrarse</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Estado</p>
              <SelectDropdown
                value={currentStatus}
                options={STATUSES}
                onChange={v => {
                updateTask(task.id, { status: v })
                api.tasks.update(task.id, { status: STATUS_TO_API[v] }).catch(console.error)
              }}
                renderBadge={v => <StatusBadge status={v} />}
              />
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                <Flag className="w-3 h-3" /> Prioridad
              </p>
              <SelectDropdown
                value={currentPriority}
                options={PRIORITIES}
                onChange={v => {
                updateTask(task.id, { priority: v })
                api.tasks.update(task.id, { priority: PRIORITY_TO_API[v] }).catch(console.error)
              }}
                renderBadge={v => <PriorityBadge priority={v} />}
              />
            </div>

            {(() => {
              const board = boards.find(b => b.id === task.boardId)
              return board && board.groups.length > 1 ? (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 font-medium mb-1">Grupo</p>
                  <select
                    value={task.groupId}
                    onChange={e => {
                      const newGroupId = e.target.value
                      if (newGroupId === task.groupId) return
                      setTaskOrigin(task.id, task.groupId)
                      patchApiTask(task.id, { groupId: newGroupId })
                      api.tasks.move(task.id, newGroupId).catch(() => {
                        patchApiTask(task.id, { groupId: task.groupId })
                      })
                    }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {board.groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              ) : null
            })()}
            {workspaceUens.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-medium mb-1">UEN</p>
                <div className="flex flex-wrap gap-1.5">
                  {workspaceUens.map(u => {
                    const active = currentUenIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          const newIds = active ? currentUenIds.filter(id => id !== u.id) : [...currentUenIds, u.id]
                          patchApiTask(task.id, { uenIds: newIds })
                          api.tasks.update(task.id, { uenIds: newIds }).catch(console.error)
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${active ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                        style={active ? { backgroundColor: u.color, borderColor: u.color } : {}}
                      >
                        {u.name}
                      </button>
                    )
                  })}
                </div>
                {currentUenIds.length === 0 && (
                  <p className="text-xs text-gray-400 italic mt-1">Ninguna seleccionada</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Creado el {new Date(task.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Descripción
            </p>
            {editingDesc ? (
              <div>
                <textarea
                  autoFocus
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  onBlur={saveDesc}
                  rows={4}
                  className="w-full text-sm text-gray-700 leading-relaxed bg-white border border-blue-400 rounded-lg p-3 focus:outline-none resize-none"
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={saveDesc} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
                  <button onClick={() => setEditingDesc(false)} className="text-xs px-3 py-1 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <p
                onDoubleClick={startEditDesc}
                title="Doble clic para editar"
                className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 cursor-text hover:bg-gray-100 transition-colors"
              >
                {currentDesc || <span className="text-gray-400 italic">Sin descripción. Doble clic para agregar.</span>}
              </p>
            )}
          </div>

          {task.text && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Texto adicional</p>
              <p className="text-sm text-gray-600 leading-relaxed">{task.text}</p>
            </div>
          )}

          <div className="border-t border-gray-100" />
          <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
            <MessageSquare className="w-3.5 h-3.5" /> Comunicación
          </div>
          <CommentList taskId={task.id} />

          <div className="border-t border-gray-100" />
          <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
            <Clock className="w-3.5 h-3.5" /> Historial de actividad
          </div>
          <ActivityTimeline taskId={task.id} />
        </div>
      </aside>

      {showMoveModal && (
        <MoveBoardModal
          taskId={task.id}
          taskTitle={task.title}
          currentBoardId={task.boardId}
          onClose={() => setShowMoveModal(false)}
          onMoved={() => { close(); navigate('/boards') }}
        />
      )}
    </>
  )
}
