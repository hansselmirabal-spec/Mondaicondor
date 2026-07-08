import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { ApiTaskWithBoard, ApiTaskDetail, ApiComment } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { getStatusInfo, getPriorityStyle } from '@/lib/utils'
import {
  ClipboardList, Calendar, ChevronRight, X, Send, Loader2,
  Building2, Users, CheckCircle2, Clock
} from 'lucide-react'

type FilterTab = 'todas' | 'pendientes' | 'completadas'

const DONE_STATUSES = new Set(['Completado', 'AlwaysOn'])
const FALLBACK_STATUSES = [
  { slug: 'Nuevo',      label: 'Nuevo' },
  { slug: 'Asignado',   label: 'Asignado' },
  { slug: 'EnProgreso', label: 'En progreso' },
  { slug: 'EnRevision', label: 'En revisión' },
  { slug: 'Bloqueado',  label: 'Bloqueado' },
  { slug: 'Completado', label: 'Completado' },
]

function statusBg(slug: string) {
  return getStatusInfo(slug, [])
}

function priorityBg(priority: string) {
  return getPriorityStyle(priority as any)
}

function fmtDeadline(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })
}

function isOverdue(iso: string | null) {
  if (!iso) return false
  return iso.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

// ── Task detail panel ────────────────────────────────────────────────────────
interface TaskPanelProps {
  taskId: string
  onClose: () => void
  onStatusChange: (taskId: string, status: string) => void
}

function TaskPanel({ taskId, onClose, onStatusChange }: TaskPanelProps) {
  const [task, setTask] = useState<ApiTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    api.tasks.get(taskId)
      .then(({ task }) => setTask(task))
      .catch(() => toast('Error al cargar la tarea', 'error'))
      .finally(() => setLoading(false))
  }, [taskId])

  async function handleStatusChange(status: string) {
    if (!task) return
    setSaving(true)
    try {
      await api.tasks.update(task.id, { status })
      setTask(t => t ? { ...t, status } : t)
      onStatusChange(task.id, status)
    } catch (e) {
      toast((e as Error).message ?? 'Error al actualizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddComment() {
    if (!task || !comment.trim()) return
    setSendingComment(true)
    try {
      const { comment: created } = await api.tasks.addComment(task.id, comment.trim())
      setTask(t => t ? { ...t, comments: [...t.comments, created as ApiComment & { author: any }] } : t)
      setComment('')
    } catch (e) {
      toast((e as Error).message ?? 'Error al comentar', 'error')
    } finally {
      setSendingComment(false)
    }
  }

  const { bg: statusBgColor, text: statusText, label: statusLabel } = task
    ? statusBg(task.status)
    : { bg: '#c4c4c4', text: '#333', label: '...' }

  const deadlineStr = task ? fmtDeadline(task.deadline) : null
  const overdue = task ? isOverdue(task.deadline) : false

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 truncate pr-2">
          {loading ? 'Cargando...' : task?.title ?? ''}
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      ) : task ? (
        <div className="flex-1 overflow-y-auto">
          {/* Metadata */}
          <div className="px-4 py-3 space-y-3 border-b border-gray-50">
            {/* Status selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Estado</span>
              <div className="relative">
                <select
                  value={task.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={saving}
                  className="appearance-none text-xs font-medium px-2 py-1 rounded cursor-pointer pr-5 border-0 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  style={{ backgroundColor: statusBgColor, color: statusText }}
                >
                  {FALLBACK_STATUSES.map(s => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>
                {saving && <Loader2 className="absolute right-1 top-1 w-3 h-3 animate-spin" style={{ color: statusText }} />}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Prioridad</span>
              {(() => {
                const { bg, text } = priorityBg(task.priority)
                return (
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: bg, color: text }}>
                    {task.priority}
                  </span>
                )
              })()}
            </div>

            {/* UEN */}
            {task.uens && task.uens.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 shrink-0">UEN</span>
                <div className="flex flex-wrap gap-1">
                  {task.uens.map(u => (
                    <span
                      key={u.id}
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: u.color + '22', color: u.color }}
                    >
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Deadline */}
            {deadlineStr && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 shrink-0">Fecha</span>
                <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                  <Calendar className="w-3 h-3" />
                  {deadlineStr}
                  {overdue && <span className="text-red-500">(vencida)</span>}
                </span>
              </div>
            )}

            {/* Assignees */}
            {task.assignees.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 w-16 shrink-0 mt-0.5">Asignados</span>
                <div className="flex flex-wrap gap-1.5">
                  {task.assignees.map(({ user }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 rounded-full px-2 py-0.5"
                    >
                      <span
                        className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.initials}
                      </span>
                      {user.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="pt-1">
                <p className="text-xs text-gray-400 mb-1">Descripción</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-3">
              Comentarios {task.comments.length > 0 && `(${task.comments.length})`}
            </p>

            {task.comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin comentarios aún.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {task.comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <span
                      className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: (c.author as any).color ?? '#6366f1' }}
                    >
                      {(c.author as any).initials ?? c.author.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-semibold text-gray-700">{c.author.name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="mt-3 flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment()
                }}
                placeholder="Agregar comentario... (Ctrl+Enter para enviar)"
                rows={2}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleAddComment}
                disabled={!comment.trim() || sendingComment}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white rounded-lg transition-colors shrink-0"
              >
                {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function MisTareasPage() {
  const [tasks, setTasks] = useState<ApiTaskWithBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('pendientes')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    api.tasks.mine()
      .then(({ tasks }) => setTasks(tasks))
      .catch(() => toast('Error al cargar tus tareas', 'error'))
      .finally(() => setLoading(false))
    const poll = setInterval(() => {
      api.tasks.mine().then(({ tasks }) => setTasks(tasks)).catch(() => {})
    }, 5_000)
    return () => clearInterval(poll)
  }, [])

  function handleStatusChange(taskId: string, status: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  const filtered = tasks.filter(t => {
    const done = DONE_STATUSES.has(t.status)
    if (filter === 'pendientes') return !done
    if (filter === 'completadas') return done
    return true
  })

  // Group by board
  const byBoard: Record<string, { name: string; tasks: ApiTaskWithBoard[] }> = {}
  for (const task of filtered) {
    const { boardId, board } = task.group
    if (!byBoard[boardId]) byBoard[boardId] = { name: board.name, tasks: [] }
    byBoard[boardId].tasks.push(task)
  }

  const pendingCount = tasks.filter(t => !DONE_STATUSES.has(t.status)).length
  const doneCount = tasks.filter(t => DONE_STATUSES.has(t.status)).length

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: tasks.length },
    { key: 'pendientes', label: 'Pendientes', count: pendingCount },
    { key: 'completadas', label: 'Completadas', count: doneCount },
  ]

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      {/* Task list */}
      <div className={`flex flex-col overflow-hidden transition-all duration-200 ${selectedTaskId ? 'w-[60%]' : 'w-full'}`}>
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            <h1 className="text-lg font-bold text-gray-800">Mis Tareas</h1>
            <span className="text-sm text-gray-400 ml-1">— todas las tareas donde sos responsable</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  filter === tab.key
                    ? tab.key === 'completadas'
                      ? 'bg-green-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : tab.key === 'completadas' && doneCount > 0
                      ? 'text-green-700 hover:bg-green-50 border border-green-200'
                      : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.key === 'todas' && <ClipboardList className="w-3 h-3" />}
                {tab.key === 'pendientes' && <Clock className="w-3 h-3" />}
                {tab.key === 'completadas' && <CheckCircle2 className="w-3 h-3" />}
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  filter === tab.key
                    ? 'bg-white/20'
                    : tab.key === 'completadas' && doneCount > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No tenés tareas asignadas</p>
              <p className="text-xs text-gray-400 mt-1">Cuando alguien te asigne a una tarea, aparecerá aquí.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No hay tareas con ese filtro.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(byBoard).map(([boardId, { name: boardName, tasks: boardTasks }]) => (
                <div key={boardId}>
                  {/* Board section header */}
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{boardName}</span>
                    <span className="text-xs text-gray-400">({boardTasks.length})</span>
                  </div>

                  {/* Task rows */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 w-[32%]">Tarea</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[12%]">Grupo</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[10%]">UEN</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[13%]">Estado</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[10%]">Prioridad</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[11%]">Fecha</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-[8%]">Equipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {boardTasks.map(task => {
                          const { bg: sBg, text: sText, label: sLabel } = statusBg(task.status)
                          const { bg: pBg, text: pText } = priorityBg(task.priority)
                          const dl = fmtDeadline(task.deadline)
                          const over = isOverdue(task.deadline)
                          const isSelected = selectedTaskId === task.id

                          return (
                            <tr
                              key={task.id}
                              onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                              className={`group cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {/* Title */}
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${
                                    DONE_STATUSES.has(task.status) ? 'line-through text-gray-400' : 'text-gray-800'
                                  }`}>
                                    {task.title}
                                  </span>
                                  <ChevronRight className={`w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0 ${isSelected ? 'text-indigo-400' : ''}`} />
                                </div>
                              </td>

                              {/* Group */}
                              <td className="px-3 py-2.5">
                                <span className="text-xs text-gray-500 truncate">{task.group.name}</span>
                              </td>

                              {/* UEN */}
                              <td className="px-3 py-2.5">
                                {task.uens && task.uens.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {task.uens.map(u => (
                                      <span
                                        key={u.id}
                                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: u.color + '22', color: u.color }}
                                      >
                                        {u.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-2.5">
                                <span
                                  className="text-xs font-medium px-2 py-0.5 rounded"
                                  style={{ backgroundColor: sBg, color: sText }}
                                >
                                  {sLabel}
                                </span>
                              </td>

                              {/* Priority */}
                              <td className="px-3 py-2.5">
                                <span
                                  className="text-xs font-medium px-2 py-0.5 rounded"
                                  style={{ backgroundColor: pBg, color: pText }}
                                >
                                  {task.priority}
                                </span>
                              </td>

                              {/* Deadline */}
                              <td className="px-3 py-2.5">
                                {dl ? (
                                  <span className={`text-xs flex items-center gap-1 ${over ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    {dl}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>

                              {/* Assignees */}
                              <td className="px-3 py-2.5">
                                <div className="flex -space-x-1">
                                  {task.assignees.slice(0, 3).map(({ user }) => (
                                    <span
                                      key={user.id}
                                      title={user.name}
                                      className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center border border-white"
                                      style={{ backgroundColor: user.color }}
                                    >
                                      {user.initials}
                                    </span>
                                  ))}
                                  {task.assignees.length > 3 && (
                                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center border border-white">
                                      +{task.assignees.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task detail panel */}
      {selectedTaskId && (
        <div className="w-[40%] border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          <TaskPanel
            key={selectedTaskId}
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}
    </div>
  )
}
