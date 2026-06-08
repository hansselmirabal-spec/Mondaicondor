import { ChevronDown, Zap, UserPlus, Link2, MoreHorizontal, Share2, X, Send, Settings, Archive, Copy, Check, Loader2, Pencil } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import type { MockBoard } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { useBoardStore } from '@/store/boardStore'
import { toast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

interface BoardHeaderProps { board: MockBoard }

export function BoardHeader({ board }: BoardHeaderProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const apiUsers = useBoardStore(state => state.apiUsers)
  const patchBoard = useBoardStore(state => state.patchBoard)
  const [inviteModal, setInviteModal] = useState(false)
  const [renamingBoard, setRenamingBoard] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
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

  async function sendInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    setInviteError(null)
    setInviteLink(null)
    try {
      const { inviteUrl } = await api.workspaces.invite(board.workspaceId, email, inviteRole)
      const fullLink = `${window.location.origin}${inviteUrl}`
      setInviteLink(fullLink)
      setInviteEmail('')
    } catch (err) {
      setInviteError((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
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

  function closeInviteModal() {
    setInviteModal(false)
    setInviteEmail('')
    setInviteError(null)
    setInviteLink(null)
    setLinkCopied(false)
  }

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
                <Pencil className="w-4 h-4 text-gray-400" /> Editar nombre
              </button>
              <button onClick={() => { toast('Descripción próximamente.'); setTitleMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Copy className="w-4 h-4 text-gray-400" /> Duplicar tablero
              </button>
              <button onClick={() => { setInviteModal(true); setTitleMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <UserPlus className="w-4 h-4 text-gray-400" /> Administrar miembros
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
          <button onClick={() => openPanel('automations')} className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span>Automatizar / 6</span>
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            onClick={() => setInviteModal(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invitar / {apiUsers.length}</span>
          </button>
          <button
            onClick={() => toast('Enlace de invitación copiado.', 'success')}
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
                  Configuración
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

      <Modal isOpen={inviteModal} onClose={closeInviteModal} title="Invitar miembros" size="md">
        <div className="p-5 space-y-4">

          {/* Input row */}
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') sendInvite() }}
              placeholder="email@ejemplo.com"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
              className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MEMBER">Miembro</option>
              <option value="VIEWER">Visualizador</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={sendInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Generar link
            </button>
          </div>

          {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}

          {/* Generated invite link */}
          {inviteLink && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-green-700">Link de invitación generado — válido 7 días</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 font-mono truncate">{inviteLink}</p>
                <button
                  onClick={copyInviteLink}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${linkCopied ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
                >
                  {linkCopied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                </button>
              </div>
              <p className="text-xs text-gray-400">Compartí este link. Quien lo abra, inicie sesión y acepte quedará como {inviteRole === 'ADMIN' ? 'Admin' : inviteRole === 'VIEWER' ? 'Visualizador' : 'Miembro'}.</p>
            </div>
          )}

          {/* Current members */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Miembros actuales ({apiUsers.length})</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {apiUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 py-1">
                  <AssigneeAvatar userId={user.id} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </Modal>
    </>
  )
}
