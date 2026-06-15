import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus, Star, MoreHorizontal, Pencil, Trash2, Lock, Globe, Users, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { toMockBoard } from '@/lib/adapters'
import type { MockBoard } from '@/types'
import type { ApiBoardMember, ApiUser } from '@/lib/api'

export function BoardsPage() {
  const navigate = useNavigate()
  const { boards, setBoards, addBoard, removeBoard, patchBoard, toggleFavorite, isFavorite, workspace } = useBoardStore()

  const workspaceId = workspace?.id ?? null
  const [loading, setLoading] = useState(true)

  // Create modal
  const [showModal, setShowModal] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [boardDesc, setBoardDesc] = useState('')
  const [boardPrivate, setBoardPrivate] = useState(false)

  // Edit modal
  const [editingBoard, setEditingBoard] = useState<MockBoard | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Card dropdown menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Privacy modal
  const [privacyBoard, setPrivacyBoard] = useState<MockBoard | null>(null)
  const [privacyMembers, setPrivacyMembers] = useState<ApiBoardMember[]>([])
  const [allUsers, setAllUsers] = useState<ApiUser[]>([])
  const [privacyLoading, setPrivacyLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }
    setLoading(true)
    async function load() {
      try {
        const { boards: apiBoards } = await api.boards.listByWorkspace(workspaceId!)
        setBoards(apiBoards.map(toMockBoard))
      } catch (e) {
        console.error('Error cargando tableros:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [workspaceId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    if (openMenuId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!boardName.trim() || !workspaceId) return
    try {
      const { board: apiBoard } = await api.boards.create({
        name: boardName.trim(),
        description: boardDesc.trim(),
        workspaceId,
        isPrivate: boardPrivate,
      })
      addBoard(toMockBoard(apiBoard))
      setBoardName('')
      setBoardDesc('')
      setBoardPrivate(false)
      setShowModal(false)
      toast('Tablero creado.', 'success')
    } catch {
      toast('Error al crear el tablero.', 'error')
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(board: MockBoard, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenMenuId(null)
    setEditingBoard(board)
    setEditName(board.name)
    setEditDesc(board.description)
  }

  async function handleEdit() {
    if (!editingBoard || !editName.trim()) return
    try {
      await api.boards.update(editingBoard.id, { name: editName.trim(), description: editDesc.trim() })
      patchBoard(editingBoard.id, { name: editName.trim(), description: editDesc.trim() })
      setEditingBoard(null)
      toast('Tablero actualizado.', 'success')
    } catch {
      toast('Error al actualizar.', 'error')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDeleteId) return
    try {
      await api.boards.delete(confirmDeleteId)
      removeBoard(confirmDeleteId)
      setConfirmDeleteId(null)
      toast('Tablero eliminado.', 'success')
    } catch {
      toast('Error al eliminar.', 'error')
    }
  }

  // ── Privacy modal ─────────────────────────────────────────────────────────
  async function openPrivacy(board: MockBoard, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenMenuId(null)
    setPrivacyBoard(board)
    setPrivacyLoading(true)
    try {
      const [{ members }, { users }] = await Promise.all([
        api.boards.listMembers(board.id),
        api.users.list(),
      ])
      setPrivacyMembers(members)
      setAllUsers(users)
    } catch {
      toast('Error al cargar miembros.', 'error')
    } finally {
      setPrivacyLoading(false)
    }
  }

  async function handleTogglePrivacy() {
    if (!privacyBoard) return
    const next = !privacyBoard.isPrivate
    try {
      await api.boards.update(privacyBoard.id, { isPrivate: next })
      patchBoard(privacyBoard.id, { isPrivate: next })
      setPrivacyBoard(b => b ? { ...b, isPrivate: next } : null)
      toast(next ? 'Tablero marcado como privado.' : 'Tablero marcado como público.', 'success')
    } catch {
      toast('Error al actualizar privacidad.', 'error')
    }
  }

  async function handleAddBoardMember(userId: string) {
    if (!privacyBoard) return
    try {
      const { member } = await api.boards.addMember(privacyBoard.id, userId)
      setPrivacyMembers(prev => [...prev, member])
      toast('Miembro agregado.', 'success')
    } catch {
      toast('Error al agregar miembro.', 'error')
    }
  }

  async function handleRemoveBoardMember(userId: string) {
    if (!privacyBoard) return
    try {
      await api.boards.removeMember(privacyBoard.id, userId)
      setPrivacyMembers(prev => prev.filter(m => m.userId !== userId))
      toast('Miembro eliminado del tablero.', 'success')
    } catch {
      toast('Error al eliminar miembro.', 'error')
    }
  }

  const memberIds = new Set(privacyMembers.map(m => m.userId))
  const nonMembers = allUsers.filter(u => !memberIds.has(u.id))

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-400">Cargando tableros...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tableros</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo tablero
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(board => {
            const fav = isFavorite(board.id)
            const isConfirmingDelete = confirmDeleteId === board.id
            const isMenuOpen = openMenuId === board.id

            return (
              <div
                key={board.id}
                onClick={() => !isConfirmingDelete && navigate(`/boards/${board.id}`)}
                className={`relative bg-white rounded-xl border p-5 transition-all group ${
                  isConfirmingDelete
                    ? 'border-red-300 shadow-md cursor-default'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                }`}
              >
                {isConfirmingDelete ? (
                  <div className="flex flex-col items-center justify-center gap-3 min-h-[120px]">
                    <p className="text-sm font-semibold text-gray-800 text-center">
                      ¿Eliminar <span className="text-red-600">{board.name}</span>?
                    </p>
                    <p className="text-xs text-gray-500 text-center">Esta acción no se puede deshacer.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="px-4 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete() }}
                        className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (board.groups[0]?.color ?? '#3b82f6') + '20' }}>
                        <LayoutGrid className="w-5 h-5" style={{ color: board.groups[0]?.color ?? '#3b82f6' }} />
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          onClick={e => { e.stopPropagation(); toggleFavorite(board.id) }}
                          className="p-1 rounded transition-colors cursor-pointer"
                          title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        >
                          <Star className={`w-4 h-4 transition-colors ${fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`} />
                        </div>
                        <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : board.id) }}
                            className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                            title="Opciones"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-7 z-20 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                              <button
                                onClick={e => openEdit(board, e)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                onClick={e => openPrivacy(board, e)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Users className="w-3.5 h-3.5" />
                                Privacidad y acceso
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuId(null); setConfirmDeleteId(board.id) }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{board.name}</h3>
                      {board.isPrivate && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{board.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{board.groups.length} grupos</span>
                      {board.isPrivate && (
                        <span className="flex items-center gap-1 text-indigo-500 font-medium">
                          <Lock className="w-3 h-3" />
                          Privado
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <button
            onClick={() => setShowModal(true)}
            className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-5 hover:border-blue-300 hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-2 min-h-[160px] text-gray-400 cursor-pointer"
          >
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">Nuevo tablero</span>
          </button>
        </div>
      </div>

      {/* Create modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setBoardPrivate(false) }} title="Crear nuevo tablero" size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mi tablero"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
            <textarea
              value={boardDesc}
              onChange={e => setBoardDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción opcional"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Visibilidad</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBoardPrivate(false)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-colors text-sm ${
                  !boardPrivate ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-5 h-5" />
                <span className="font-medium text-xs">Público</span>
                <span className="text-xs opacity-60 leading-tight text-center px-1">Todos los miembros</span>
              </button>
              <button
                type="button"
                onClick={() => setBoardPrivate(true)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-colors text-sm ${
                  boardPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="font-medium text-xs">Privado</span>
                <span className="text-xs opacity-60 leading-tight text-center px-1">Solo invitados</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowModal(false); setBoardPrivate(false) }} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} disabled={!boardName.trim()} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors">
              Crear
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editingBoard} onClose={() => setEditingBoard(null)} title="Editar tablero" size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEdit() }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción opcional"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditingBoard(null)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button onClick={handleEdit} disabled={!editName.trim()} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors">
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Privacy & members modal */}
      <Modal isOpen={!!privacyBoard} onClose={() => setPrivacyBoard(null)} title="Privacidad y acceso" size="md">
        {privacyBoard && (
          <div className="p-5 space-y-5">
            {/* Visibility toggle */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visibilidad — {privacyBoard.name}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => !privacyBoard.isPrivate || handleTogglePrivacy()}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors text-sm ${
                    !privacyBoard.isPrivate ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="w-5 h-5 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Público</p>
                    <p className="text-xs opacity-60">Todos los miembros del workspace</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => privacyBoard.isPrivate || handleTogglePrivacy()}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors text-sm ${
                    privacyBoard.isPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Lock className="w-5 h-5 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Privado</p>
                    <p className="text-xs opacity-60">Solo miembros invitados</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Members with access */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Miembros con acceso ({privacyMembers.length})
              </p>
              {privacyLoading ? (
                <p className="text-xs text-gray-400 py-2">Cargando...</p>
              ) : privacyMembers.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Sin miembros explícitos.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {privacyMembers.map(m => (
                    <div key={m.userId} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: m.user.color }}
                      >
                        {m.user.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveBoardMember(m.userId)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        title="Quitar acceso"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add members */}
            {nonMembers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agregar miembro</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {nonMembers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAddBoardMember(u.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors text-left"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <span className="text-xs text-indigo-500 font-medium shrink-0">+ Agregar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1">
              <button onClick={() => setPrivacyBoard(null)} className="w-full py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
