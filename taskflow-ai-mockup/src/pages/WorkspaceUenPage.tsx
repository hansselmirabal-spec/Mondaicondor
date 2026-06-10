import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, AlertCircle } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import type { WorkspaceUen } from '@/types'

const PRESET_COLORS = [
  '#c4c4c4', '#e2445c', '#579bfc', '#a25ddc', '#bb3354',
  '#00c875', '#00c2cd', '#fdab3d', '#e2e253', '#333333',
  '#ff7575', '#9aadbd', '#66ccff', '#ff642e', '#7e3af2',
]

interface EditingUen {
  id: string
  name: string
  color: string
}

export function WorkspaceUenPage() {
  const { workspaceUens, setWorkspaceUens, workspace } = useBoardStore()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<EditingUen | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#579bfc')
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    api.workspaces.listUens(workspace.id)
      .then(({ uens }) => setWorkspaceUens(uens as WorkspaceUen[]))
      .catch(() => toast('Error cargando UENs.', 'error'))
      .finally(() => setLoading(false))
  }, [workspace?.id])

  async function handleSaveEdit() {
    if (!editing || !workspace) return
    setSaving(true)
    try {
      const { uen } = await api.workspaces.updateUen(workspace.id, editing.id, {
        name: editing.name.trim(),
        color: editing.color,
      })
      setWorkspaceUens(workspaceUens.map(u => u.id === editing.id ? { ...u, ...uen } as WorkspaceUen : u))
      setEditing(null)
      toast('UEN actualizada.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !workspace) return
    setSaving(true)
    try {
      const { uen } = await api.workspaces.createUen(workspace.id, {
        name: newName.trim(),
        color: newColor,
      })
      setWorkspaceUens([...workspaceUens, uen as WorkspaceUen])
      setNewName('')
      setNewColor('#579bfc')
      setShowNewForm(false)
      toast('UEN creada.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(uenId: string) {
    if (!workspace) return
    setDeleting(uenId)
    try {
      await api.workspaces.deleteUen(workspace.id, uenId)
      setWorkspaceUens(workspaceUens.filter(u => u.id !== uenId))
      toast('UEN eliminada.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setDeleting(null)
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
        <p className="text-sm text-gray-400">Cargando UENs...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">UENs</h1>
          <p className="text-sm text-gray-500">
            Definí las Unidades Estratégicas de Negocio para clasificar las tareas de{' '}
            <span className="font-medium text-gray-700">{workspace.name}</span>.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {workspaceUens.length} UEN{workspaceUens.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva UEN
            </button>
          </div>

          {/* UEN list */}
          <div className="divide-y divide-gray-100">
            {workspaceUens.map(uen => (
              <div key={uen.id} className="flex items-center gap-3 px-4 py-3">
                {/* Color circle */}
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: uen.color }} />

                {editing?.id === uen.id ? (
                  /* Edit mode */
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={e => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 min-w-[120px] px-2 py-1 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                      onClick={() => setEditing({ id: uen.id, name: uen.name, color: uen.color })}
                      className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate"
                    >
                      {uen.name}
                    </button>
                    <button
                      onClick={() => handleDelete(uen.id)}
                      disabled={deleting === uen.id}
                      title="Eliminar UEN"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* New UEN form */}
            {showNewForm && (
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 space-y-3">
                <p className="text-xs font-semibold text-blue-700">Nueva UEN</p>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-1 ring-blue-400" style={{ backgroundColor: newColor }} />
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false) }}
                    placeholder="Nombre de la UEN..."
                    className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
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
                    disabled={!newName.trim() || saving}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => { setShowNewForm(false); setNewName(''); setNewColor('#579bfc') }}
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
          <span>Las UENs se aplican a todas las tareas de este workspace. Eliminá una UEN solo si no tiene tareas asignadas.</span>
        </div>
      </div>
    </div>
  )
}
