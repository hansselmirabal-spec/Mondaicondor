import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Check, X, AlertCircle } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { HelpTip } from '@/components/ui/HelpTip'
import type { WorkspaceStatus } from '@/types'

const PRESET_COLORS = [
  '#c4c4c4', '#e2445c', '#579bfc', '#a25ddc', '#bb3354',
  '#00c875', '#00c2cd', '#fdab3d', '#e2e253', '#333333',
  '#ff7575', '#9aadbd', '#66ccff', '#ff642e', '#7e3af2',
]

interface EditingStatus {
  id: string
  label: string
  color: string
}

export function WorkspaceStatusPage() {
  const { workspaceStatuses, setWorkspaceStatuses, workspace } = useBoardStore()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<EditingStatus | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#579bfc')
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    api.workspaces.listStatuses(workspace.id)
      .then(({ statuses }) => setWorkspaceStatuses(statuses as WorkspaceStatus[]))
      .catch(() => toast('Error cargando estados.', 'error'))
      .finally(() => setLoading(false))
  }, [workspace?.id])

  async function handleSaveEdit() {
    if (!editing || !workspace) return
    setSaving(true)
    try {
      const { status } = await api.workspaces.updateStatus(workspace.id, editing.id, {
        label: editing.label.trim(),
        color: editing.color,
      })
      setWorkspaceStatuses(workspaceStatuses.map(s => s.id === editing.id ? { ...s, ...status } as WorkspaceStatus : s))
      setEditing(null)
      toast('Estado actualizado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    if (!newLabel.trim() || !workspace) return
    setSaving(true)
    try {
      const { status } = await api.workspaces.createStatus(workspace.id, {
        label: newLabel.trim(),
        color: newColor,
      })
      setWorkspaceStatuses([...workspaceStatuses, status as WorkspaceStatus])
      setNewLabel('')
      setNewColor('#579bfc')
      setShowNewForm(false)
      toast('Estado creado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(statusId: string) {
    if (!workspace) return
    setDeleting(statusId)
    try {
      await api.workspaces.deleteStatus(workspace.id, statusId)
      setWorkspaceStatuses(workspaceStatuses.filter(s => s.id !== statusId))
      toast('Estado eliminado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function moveStatus(idx: number, dir: -1 | 1) {
    if (!workspace) return
    const next = [...workspaceStatuses]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    const reordered = next.map((s, i) => ({ ...s, position: i }))
    setWorkspaceStatuses(reordered)
    try {
      await api.workspaces.reorderStatuses(workspace.id, reordered.map(s => s.id))
    } catch {
      toast('Error al reordenar.', 'error')
    }
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Cargá un tablero primero para acceder al workspace.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Cargando estados...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Estados del workspace</h1>
            <HelpTip title="Estados">
              <p>Estos estados son propios de este espacio de trabajo y los usa cualquier tablero adentro.</p>
              <p>No se puede eliminar un estado que todavía tenga tareas asignadas — primero hay que reasignarlas.</p>
            </HelpTip>
          </div>
          <p className="text-sm text-gray-500">Personalizá los estados disponibles para las tareas de <span className="font-medium text-gray-700">{workspace.name}</span>.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {workspaceStatuses.length} estado{workspaceStatuses.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo estado
            </button>
          </div>

          {/* Status list */}
          <div className="divide-y divide-gray-100">
            {workspaceStatuses.map((status, idx) => (
              <div key={status.id} className="flex items-center gap-3 px-4 py-3">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveStatus(idx, -1)}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                    title="Subir"
                  >
                    <GripVertical className="w-3 h-3 rotate-[270deg]" />
                  </button>
                  <button
                    onClick={() => moveStatus(idx, 1)}
                    disabled={idx === workspaceStatuses.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                    title="Bajar"
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </button>
                </div>

                {/* Color circle */}
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: status.color }} />

                {editing?.id === status.id ? (
                  /* Edit mode */
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <input
                      autoFocus
                      value={editing.label}
                      onChange={e => setEditing({ ...editing, label: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 min-w-[120px] px-2 py-1 border border-primary-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditing({ ...editing, color: c })}
                          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${editing.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <button
                      onClick={() => setEditing({ id: status.id, label: status.label, color: status.color })}
                      className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-primary-600 transition-colors truncate"
                    >
                      {status.label}
                      {status.isDefault && (
                        <span className="ml-2 text-[10px] font-normal text-gray-400 bg-gray-100 rounded px-1 py-0.5">predeterminado</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(status.id)}
                      disabled={deleting === status.id}
                      title="Eliminar estado"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* New status form */}
            {showNewForm && (
              <div className="px-4 py-3 bg-primary-50 border-t border-primary-100 space-y-3">
                <p className="text-xs font-semibold text-primary-700">Nuevo estado</p>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-1 ring-primary-400" style={{ backgroundColor: newColor }} />
                  <input
                    autoFocus
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false) }}
                    placeholder="Nombre del estado..."
                    className="flex-1 px-2 py-1 border border-primary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newLabel.trim() || saving}
                    className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-200 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => { setShowNewForm(false); setNewLabel(''); setNewColor('#579bfc') }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
          <span>Los estados se aplican a todas las tareas de este workspace. No podés eliminar un estado si tiene tareas asignadas.</span>
        </div>
      </div>
    </div>
  )
}
