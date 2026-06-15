import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutGrid, Home, Plus, Lock, Globe } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toMockBoard } from '@/lib/adapters'
import { toast } from '@/components/ui/Toast'

export function BoardList() {
  const navigate = useNavigate()
  const { boardId } = useParams()
  const workspace = useBoardStore(state => state.workspace)
  const boards = useBoardStore(state => state.boards)
  const setBoards = useBoardStore(state => state.setBoards)
  const addBoard = useBoardStore(state => state.addBoard)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrivate, setNewPrivate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!newName.trim() || !workspace) return
    setSaving(true)
    try {
      const { board: apiBoard } = await api.boards.create({
        name: newName.trim(),
        workspaceId: workspace.id,
        isPrivate: newPrivate,
      })
      const mock = toMockBoard(apiBoard)
      addBoard(mock)
      toast('Panel creado.', 'success')
      setNewName('')
      setNewPrivate(false)
      setAdding(false)
      navigate(`/boards/${mock.id}`)
    } catch {
      toast('Error al crear el panel.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function togglePanel(id: string) {
    const isOpen = expanded.has(id)
    if (isOpen) {
      setExpanded(prev => { const n = new Set(prev); n.delete(id); return n })
      return
    }
    setExpanded(prev => new Set([...prev, id]))
    const board = boards.find(b => b.id === id)
    if (!board || board.groups.length > 0) return
    setLoadingGroups(prev => new Set([...prev, id]))
    try {
      const { board: apiBoard } = await api.boards.get(id)
      const mock = toMockBoard(apiBoard)
      setBoards(prev => {
        const idx = prev.findIndex(b => b.id === id)
        if (idx >= 0) { const n = [...prev]; n[idx] = mock; return n }
        return [...prev, mock]
      })
    } catch {}
    setLoadingGroups(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  return (
    <div className="px-2 py-2 space-y-0.5">
      <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-2 py-1">Paneles</p>

      <button
        onClick={() => navigate('/boards')}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
      >
        <Home className="w-4 h-4 shrink-0" />
        <span className="truncate">Inicio</span>
      </button>

      {boards.map(board => {
        const isOpen = expanded.has(board.id)
        const isLoading = loadingGroups.has(board.id)
        const isActive = boardId === board.id

        return (
          <div key={board.id}>
            <div className={`flex items-center gap-1 rounded-md transition-colors ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              <button
                onClick={() => togglePanel(board.id)}
                className="p-1 text-white/40 hover:text-white/80 shrink-0"
              >
                {isOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
              </button>
              <button
                onClick={() => navigate(`/boards/${board.id}`)}
                className="flex items-center gap-2 flex-1 min-w-0 px-1 py-1.5"
              >
                <LayoutGrid className="w-4 h-4 shrink-0 text-blue-400" />
                <span className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
                  {board.name}
                </span>
              </button>
            </div>

            {isOpen && (
              <div className="ml-6 mt-0.5 space-y-0.5">
                {isLoading ? (
                  <p className="text-xs text-white/30 px-2 py-1">Cargando...</p>
                ) : board.groups.length === 0 ? (
                  <p className="text-xs text-white/30 px-2 py-1 italic">Sin elementos</p>
                ) : board.groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/boards/${board.id}`)}
                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate">{group.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="mt-1 space-y-1.5 px-1">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewPrivate(false) }
            }}
            placeholder="Nombre del panel..."
            className="w-full px-2 py-1.5 text-xs text-white bg-white/10 border border-white/20 rounded-md focus:outline-none focus:border-blue-400 placeholder-white/30"
          />
          <button
            type="button"
            onClick={() => setNewPrivate(p => !p)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs transition-colors ${
              newPrivate
                ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-300'
                : 'border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10'
            }`}
          >
            {newPrivate ? <Lock className="w-3 h-3 shrink-0" /> : <Globe className="w-3 h-3 shrink-0" />}
            <span>{newPrivate ? 'Privado' : 'Público'}</span>
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-md transition-colors"
            >
              {saving ? '...' : 'Crear'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(''); setNewPrivate(false) }}
              className="flex-1 py-1 text-xs text-white/60 border border-white/20 hover:bg-white/10 rounded-md transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/10 rounded-md transition-colors mt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo panel</span>
        </button>
      )}
    </div>
  )
}
