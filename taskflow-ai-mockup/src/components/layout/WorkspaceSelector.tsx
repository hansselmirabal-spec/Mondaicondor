import { ChevronDown, Plus, Check, Pencil, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { toMockBoard, toMockUser } from '@/lib/adapters'
import { toast } from '@/components/ui/Toast'

export function WorkspaceSelector() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const workspaces = useBoardStore(state => state.workspaces)
  const roleOf = (ws: { members?: { userId: string; role: string }[] }) =>
    ws.members?.find(m => m.userId === user?.id)?.role
  const workspace = useBoardStore(state => state.workspace)
  const setWorkspaces = useBoardStore(state => state.setWorkspaces)
  const setWorkspace = useBoardStore(state => state.setWorkspace)
  const updateWorkspace = useBoardStore(state => state.updateWorkspace)
  const removeWorkspace = useBoardStore(state => state.removeWorkspace)
  const clearBoardData = useBoardStore(state => state.clearBoardData)
  const setBoards = useBoardStore(state => state.setBoards)
  const setApiUsers = useBoardStore(state => state.setApiUsers)
  const addBoard = useBoardStore(state => state.addBoard)

  const name = workspace?.name ?? '...'
  const color = workspace?.color ?? '#3b82f6'

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [panelName, setPanelName] = useState('')
  const [saving, setSaving] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [wsFormOpen, setWsFormOpen] = useState(false)
  const [wsName, setWsName] = useState('')
  const [wsColor, setWsColor] = useState('#6366f1')
  const [wsSaving, setWsSaving] = useState(false)

  const [editingWsId, setEditingWsId] = useState<string | null>(null)
  const [editWsName, setEditWsName] = useState('')
  const [editWsColor, setEditWsColor] = useState('#6366f1')
  const [editWsSaving, setEditWsSaving] = useState(false)
  const [confirmDeleteWsId, setConfirmDeleteWsId] = useState<string | null>(null)
  const [deletingWs, setDeletingWs] = useState(false)
  const [wsMenuOpenId, setWsMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  async function switchWorkspace(ws: { id: string; name: string; color: string }) {
    if (ws.id === workspace?.id) { setDropdownOpen(false); return }
    setSwitchingId(ws.id)
    clearBoardData()
    try {
      const [{ boards: apiBoards }, { workspace: wsDetail }] = await Promise.all([
        api.boards.listByWorkspace(ws.id),
        api.workspaces.get(ws.id),
      ])
      setWorkspace(ws)
      setBoards(apiBoards.map(toMockBoard))
      setApiUsers(wsDetail.members.map(m => toMockUser(m.user)))
      navigate('/boards')
    } catch {
      toast('Error al cambiar de workspace.', 'error')
    } finally {
      setSwitchingId(null)
      setDropdownOpen(false)
    }
  }

  async function handleCreateWorkspace() {
    if (!wsName.trim()) return
    setWsSaving(true)
    try {
      const { workspace: apiWs } = await api.workspaces.create({ name: wsName.trim(), color: wsColor })
      const ws = {
        id: apiWs.id,
        name: apiWs.name,
        color: apiWs.color,
        members: user ? [{ userId: user.id, role: 'ADMIN' as const }] : [],
      }
      setWorkspaces([...workspaces, ws])
      setWorkspace(ws)
      setBoards([])
      toast('Workspace creado.', 'success')
      setWsName('')
      setWsColor('#6366f1')
      setWsFormOpen(false)
      setDropdownOpen(false)
      navigate('/boards')
    } catch {
      toast('Error al crear el workspace.', 'error')
    } finally {
      setWsSaving(false)
    }
  }

  async function handleEditWorkspace() {
    if (!editingWsId) return
    const trimmed = editWsName.trim()
    if (!trimmed) return
    setEditWsSaving(true)
    try {
      await api.workspaces.update(editingWsId, { name: trimmed, color: editWsColor })
      updateWorkspace(editingWsId, { name: trimmed, color: editWsColor })
      toast('Workspace actualizado.', 'success')
      setEditingWsId(null)
    } catch {
      toast('Error al actualizar el workspace.', 'error')
    } finally {
      setEditWsSaving(false)
    }
  }

  async function handleDeleteWorkspace(wsId: string) {
    setDeletingWs(true)
    try {
      await api.workspaces.delete(wsId)
      removeWorkspace(wsId)
      setConfirmDeleteWsId(null)
      setDropdownOpen(false)
      navigate('/boards')
      toast('Workspace eliminado.', 'success')
    } catch {
      toast('Error al eliminar el workspace.', 'error')
    } finally {
      setDeletingWs(false)
    }
  }

  async function handleCreate() {
    if (!panelName.trim() || !workspace) return
    setSaving(true)
    try {
      const { board: apiBoard } = await api.boards.create({
        name: panelName.trim(),
        workspaceId: workspace.id,
      })
      const mock = toMockBoard(apiBoard)
      addBoard(mock)
      toast('Panel creado.', 'success')
      setPanelName('')
      setCreateOpen(false)
      navigate(`/boards/${mock.id}`)
    } catch {
      toast('Error al crear el panel.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-white/10">
      <div className="px-3 py-2 flex items-center justify-between">
        {/* Workspace switcher */}
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            onClick={() => { setDropdownOpen(o => !o); setCreateOpen(false) }}
            className="flex items-center gap-2 text-white hover:bg-white/10 rounded-md px-2 py-1.5 transition-colors w-full min-w-0"
          >
            <span
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: color }}
            >
              {name[0]}
            </span>
            <span className="text-sm font-semibold truncate">{name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-white/60 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold px-3 pt-2 pb-1">
                Mis workspaces
              </p>
              {workspaces.map(ws => (
                <div key={ws.id} className="group/ws relative">
                  {editingWsId === ws.id ? (
                    <div className="px-3 py-2 space-y-2">
                      <input
                        autoFocus
                        value={editWsName}
                        onChange={e => setEditWsName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditWorkspace()
                          if (e.key === 'Escape') setEditingWsId(null)
                        }}
                        className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:border-blue-400 placeholder-white/30"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-white/40">Color:</label>
                        <input type="color" value={editWsColor} onChange={e => setEditWsColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={handleEditWorkspace} disabled={editWsSaving || !editWsName.trim()} className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-md transition-colors">
                          {editWsSaving ? '...' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditingWsId(null)} className="flex-1 py-1 text-xs text-white/60 border border-white/20 hover:bg-white/10 rounded-md transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : confirmDeleteWsId === ws.id ? (
                    <div className="px-3 py-2 space-y-2">
                      <p className="text-xs text-white/70">¿Eliminar <strong>{ws.name}</strong>?</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleDeleteWorkspace(ws.id)} disabled={deletingWs} className="flex-1 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium rounded-md transition-colors">
                          {deletingWs ? '...' : 'Eliminar'}
                        </button>
                        <button onClick={() => setConfirmDeleteWsId(null)} className="flex-1 py-1 text-xs text-white/60 border border-white/20 hover:bg-white/10 rounded-md transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center pr-1">
                      <button
                        onClick={() => switchWorkspace(ws)}
                        disabled={switchingId === ws.id}
                        className="flex items-center gap-2.5 flex-1 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <span className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: ws.color }}>
                          {ws.name[0]}
                        </span>
                        <span className="truncate flex-1 text-left">{ws.name}</span>
                        {ws.id === workspace?.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        {switchingId === ws.id && <span className="text-xs text-white/40">...</span>}
                      </button>
                      <div className="flex items-center gap-1 shrink-0 pr-2">
                        {roleOf(ws) !== 'VIEWER' && (
                          <button
                            onClick={() => { setWsMenuOpenId(null); setEditWsName(ws.name); setEditWsColor(ws.color); setEditingWsId(ws.id) }}
                            className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            title="Editar workspace"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {roleOf(ws) === 'ADMIN' && (
                          <button
                            onClick={() => setConfirmDeleteWsId(ws.id)}
                            className="p-1.5 rounded text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="border-t border-white/10 mt-1">
                {wsFormOpen ? (
                  <div className="px-3 py-2 space-y-2">
                    <input
                      autoFocus
                      value={wsName}
                      onChange={e => setWsName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateWorkspace()
                        if (e.key === 'Escape') { setWsFormOpen(false); setWsName('') }
                      }}
                      placeholder="Nombre del workspace..."
                      className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:border-blue-400 placeholder-white/30"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-white/40">Color:</label>
                      <input
                        type="color"
                        value={wsColor}
                        onChange={e => setWsColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateWorkspace}
                        disabled={!wsName.trim() || wsSaving}
                        className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-md transition-colors"
                      >
                        {wsSaving ? '...' : 'Crear'}
                      </button>
                      <button
                        onClick={() => { setWsFormOpen(false); setWsName('') }}
                        className="flex-1 py-1 text-xs text-white/60 border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setWsFormOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo workspace</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* New panel button */}
        <button
          onClick={() => { setCreateOpen(o => !o); setDropdownOpen(false) }}
          className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
          title="Nuevo panel"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Inline create panel form */}
      {createOpen && (
        <div className="px-3 pb-3 space-y-2">
          <input
            autoFocus
            value={panelName}
            onChange={e => setPanelName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreateOpen(false); setPanelName('') }
            }}
            placeholder="Nombre del panel..."
            className="w-full px-2 py-1.5 text-sm text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:border-blue-400 placeholder-white/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!panelName.trim() || saving}
              className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-md transition-colors"
            >
              {saving ? 'Creando...' : 'Crear'}
            </button>
            <button
              onClick={() => { setCreateOpen(false); setPanelName('') }}
              className="flex-1 py-1 text-xs text-white/60 border border-white/20 hover:bg-white/10 rounded-md transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
