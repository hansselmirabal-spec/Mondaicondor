import { ChevronDown, Zap, Users, Link2, MoreHorizontal, Share2, X, Settings, Archive, Copy, Loader2, Pencil, UserPlus, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import type { MockBoard } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { useBoardStore } from '@/store/boardStore'
import { toast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import type { ApiUser } from '@/lib/api'

interface BoardHeaderProps { board: MockBoard }

export function BoardHeader({ board }: BoardHeaderProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const apiUsers = useBoardStore(state => state.apiUsers)
  const setApiUsers = useBoardStore(state => state.setApiUsers)
  const patchBoard = useBoardStore(state => state.patchBoard)

  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [renamingBoard, setRenamingBoard] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Members modal
  const [membersModal, setMembersModal] = useState(false)
  const [allUsers, setAllUsers] = useState<ApiUser[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER')
  const [inviting, setInviting] = useState(false)

  const titleRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (titleMenuOpen && titleRef.current && !titleRef.current.contains(e.target as Node)) setTitleMenuOpen(false)
      if (moreMenuOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [titleMenuOpen, moreMenuOpen])

  function openPanel(panel: string) {
    const params = new URLSearchParams(searchParams)
    params.set('panel', panel)
    params.delete('task')
    navigate('?' + params.toString())
  }

  async function openMembersModal() {
    setMembersModal(true)
    setLoadingMembers(true)
    try {
      const [{ members }, { users }] = await Promise.all([
        api.boards.listMembers(board.id),
        api.users.list(),
      ])
      const memberUsers = members.map(m => ({
        id: m.user.id, name: m.user.name, initials: m.user.initials,
        color: m.user.color, email: m.user.email,
      }))
      setApiUsers(memberUsers)
      setAllUsers(users)
    } catch {
      toast('Error al cargar miembros.', 'error')
    } finally {
      setLoadingMembers(false)
    }
  }

  function closeMembersModal() {
    setMembersModal(false)
    setInviteEmail('')
    setInviteRole('MEMBER')
  }

  async function handleInvite() {
    if (!inviteEmail.includes('@')) return
    setInviting(true)
    try {
      await api.workspaces.addMember(board.workspaceId, { email: inviteEmail.trim(), role: inviteRole, sendEmail: true })
      toast(`Invitación enviada a ${inviteEmail}`, 'success')
      setInviteEmail('')
      setInviteRole('MEMBER')
    } catch (err) {
      toast((err as Error).message ?? 'Error al enviar invitación', 'error')
    } finally {
      setInviting(false)
    }
  }

  async function handleAddMember(userId: string) {
    try {
      const { member } = await api.boards.addMember(board.id, userId)
      setApiUsers([...apiUsers, {
        id: member.user.id, name: member.user.name, initials: member.user.initials,
        color: member.user.color, email: member.user.email,
      }])
      toast('Miembro agregado.', 'success')
    } catch (err) {
      toast((err as Error).message ?? 'Error al agregar.', 'error')
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await api.boards.removeMember(board.id, userId)
      setApiUsers(apiUsers.filter(u => u.id !== userId))
      toast('Miembro eliminado del tablero.', 'success')
    } catch {
      toast('Error al eliminar.', 'error')
    }
  }

  async function handleRenameBoard() {
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === board.name) { setRenamingBoard(false); return }
    setRenameSaving(true)
    try {
      await api.boards.update(board.id, { name: trimmed })
      patchBoard(board.id, { name: trimmed })
      toast('Tablero renombrado.', 'success')
      setRenamingBoard(false)
    } catch {
      toast('Error al renombrar.', 'error')
    } finally {
      setRenameSaving(false)
    }
  }

  const memberIds = new Set(apiUsers.map(u => u.id))
  const nonMembers = allUsers.filter(u => !memberIds.has(u.id))

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div ref={titleRef} className="relative flex items-center gap-2">
          <button
            onClick={() => setTitleMenuOpen(o => !o)}
            className="flex items-center gap-1.5 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
          >
            <h1 className="text-xl font-bold text-gray-900">{board.name}</h1>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${titleMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {titleMenuOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-52 overflow-hidden">
              <button onClick={() => { setRenameDraft(board.name); setRenamingBoard(true); setTitleMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Pencil className="w-4 h-4 text-gray-400" /> Renombrar
              </button>
              <button onClick={() => { openMembersModal(); setTitleMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Users className="w-4 h-4 text-gray-400" /> Gestionar personas
              </button>
              <div className="border-t border-gray-100" />
              <button onClick={() => { toast('Tablero archivado.', 'success'); setTitleMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Archive className="w-4 h-4" /> Archivar tablero
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => openPanel('automations')} className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span>Automatizaciones</span>
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={openMembersModal}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Personas</span>
              {apiUsers.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none">
                  {apiUsers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => toast('Enlace copiado al portapapeles.', 'success')}
              title="Compartir tablero"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toast('Enlace copiado al portapapeles.', 'success')}
              title="Copiar enlace"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreMenuOpen(o => !o)}
              title="Más opciones"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-44 overflow-hidden">
                <button onClick={() => { toast('Exportado próximamente.'); setMoreMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Exportar CSV
                </button>
                <button onClick={() => { navigate(`/boards/${board.id}/settings`); setMoreMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings className="w-3.5 h-3.5 inline mr-2 text-gray-400" />Configuración
                </button>
                <div className="border-t border-gray-100" />
                <button onClick={() => { toast('Tablero archivado.', 'success'); setMoreMenuOpen(false) }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors">
                  Archivar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rename modal */}
      <Modal isOpen={renamingBoard} onClose={() => setRenamingBoard(false)} title="Renombrar tablero" size="sm">
        <div className="p-5 space-y-4">
          <input
            value={renameDraft}
            onChange={e => setRenameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard() }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => setRenamingBoard(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleRenameBoard}
              disabled={!renameDraft.trim() || renameSaving}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {renameSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Members modal */}
      <Modal isOpen={membersModal} onClose={closeMembersModal} title={`Personas — ${board.name}`} size="md">
        <div className="p-5 space-y-5">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Current board members */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Miembros del tablero ({apiUsers.length})
                </p>
                {apiUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Sin miembros asignados.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {apiUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                        <AssigneeAvatar userId={u.id} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(u.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                          title="Quitar del tablero"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add existing users */}
              {nonMembers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Agregar persona existente
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {nonMembers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAddMember(u.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors text-left"
                      >
                        <AssigneeAvatar userId={u.id} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        <span className="text-xs text-blue-500 font-medium shrink-0">+ Agregar</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite new member */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Invitar miembro
                </p>
                <p className="text-xs text-gray-400">Se generará un link de invitación y se enviará un email.</p>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="nuevo@empresa.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Miembro</option>
                  <option value="VIEWER">Visualizador</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.includes('@')}
                  className="w-full py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Generar invitación y enviar correo
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
