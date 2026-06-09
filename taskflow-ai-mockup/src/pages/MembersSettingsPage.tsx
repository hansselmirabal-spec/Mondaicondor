import { useState, useEffect } from 'react'
import {
  Loader2,
  UserPlus,
  Trash2,
  Shield,
  User,
  Eye,
  ChevronDown,
  Search,
  Check,
  Copy,
  Mail,
  Link2,
  CheckCheck,
} from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api, type ApiUser, type ApiWorkspaceMember } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { copyToClipboard } from '@/lib/utils'

type Role = 'ADMIN' | 'MEMBER' | 'VIEWER'

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Miembro',
  VIEWER: 'Visualizador',
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-orange-100 text-orange-700',
  MEMBER: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-gray-100 text-gray-600',
}

const ROLE_ICON: Record<Role, React.ReactNode> = {
  ADMIN: <Shield className="w-3 h-3" />,
  MEMBER: <User className="w-3 h-3" />,
  VIEWER: <Eye className="w-3 h-3" />,
}

// ── Inline avatar helper (works with any user object, no store lookup needed) ─
function UserAvatar({ user, size = 'md' }: { user: { name: string; initials: string; color: string; avatarUrl?: string | null }; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`rounded-full object-cover shrink-0 ${dim}`}
      />
    )
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${dim}`}
      style={{ backgroundColor: user.color }}
    >
      {user.initials}
    </span>
  )
}

// ── Role dropdown ─────────────────────────────────────────────────────────────
function RoleDropdown({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (r: Role) => void
  disabled?: boolean
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={e => onChange(e.target.value as Role)}
        disabled={disabled}
        className="appearance-none bg-white border border-gray-200 text-sm rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Miembro</option>
        <option value="VIEWER">Visualizador</option>
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Tab A: invite existing registered user ────────────────────────────────────
function InviteRegisteredTab({
  workspaceId,
  members,
  onInvited,
}: {
  workspaceId: string
  members: ApiWorkspaceMember[]
  onInvited: () => void
}) {
  const [allUsers, setAllUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ApiUser | null>(null)
  const [role, setRole] = useState<Role>('MEMBER')
  const [method, setMethod] = useState<'link' | 'email'>('link')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const memberIds = new Set(members.map(m => m.userId))

  useEffect(() => {
    api.users.list()
      .then(({ users }) => setAllUsers(users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = allUsers.filter(u => {
    const q = query.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  async function handleInvite() {
    if (!selected) return
    setInviting(true)
    try {
      await api.admin.createUser(workspaceId, { email: selected.email, role })
      toast(`${selected.name} fue agregado al workspace y notificado por correo.`, 'success')
      setSelected(null)
      setQuery('')
      onInvited()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  const available = filtered.filter(u => !memberIds.has(u.id))
  const alreadyIn = filtered.filter(u => memberIds.has(u.id))

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        El usuario será agregado al workspace y recibirá un email de notificación.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null) }}
          placeholder="Buscar por nombre o email..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-50">
        {available.length === 0 && alreadyIn.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Sin resultados</p>
        )}
        {available.map(u => {
          const isSelected = selected?.id === u.id
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(isSelected ? null : u)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'
              }`}
            >
              <UserAvatar user={u} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              {isSelected && <Check className="w-4 h-4 text-orange-500 shrink-0" />}
            </button>
          )
        })}
        {alreadyIn.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 opacity-40 cursor-not-allowed">
            <UserAvatar user={u} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
            </div>
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
              Ya es miembro
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <RoleDropdown value={role} onChange={setRole} />
        <button
          onClick={handleInvite}
          disabled={!selected || inviting}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {selected ? `Agregar a ${selected.name}` : 'Seleccioná un usuario'}
        </button>
      </div>
    </div>
  )
}

// ── Tab B: invite new user via link + email ───────────────────────────────────
function InviteNewUserTab({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isValid = email.includes('@') && email.includes('.')

  async function handleInvite() {
    if (!isValid) return
    setSubmitting(true)
    try {
      const { inviteUrl } = await api.workspaces.addMember(workspaceId, {
        email: email.trim(),
        role,
        sendEmail: true,
      })
      setInviteLink(`${window.location.origin}${inviteUrl}`)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopy() {
    if (!inviteLink) return
    copyToClipboard(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setInviteLink(null)
    setEmail('')
    setCopied(false)
  }

  if (inviteLink) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-700">Invitación generada</p>
          </div>
          <p className="text-xs text-green-600">
            Se envió un email a <span className="font-medium">{email}</span> con el link de acceso. También podés compartirlo directamente:
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-xs text-gray-700 focus:outline-none"
              onFocus={e => e.target.select()}
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm rounded-lg transition-colors"
        >
          Invitar otro usuario
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Se generará un link de invitación y se enviará un email. El usuario deberá registrarse con ese email para unirse.
      </p>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="nuevo@empresa.com"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Rol</label>
        <RoleDropdown value={role} onChange={setRole} />
      </div>
      <button
        onClick={handleInvite}
        disabled={!isValid || submitting}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Generar invitación y enviar correo
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MembersSettingsPage() {
  const { workspace } = useBoardStore()
  const currentUser = useAuthStore(state => state.user)

  const [members, setMembers] = useState<ApiWorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'registered' | 'new'>('registered')

  const isAdmin = members.find(m => m.userId === currentUser?.id)?.role === 'ADMIN'

  useEffect(() => {
    if (!workspace) return
    setLoading(true)
    api.workspaces
      .get(workspace.id)
      .then(({ workspace: ws }) => setMembers(ws.members as ApiWorkspaceMember[]))
      .catch(() => toast('Error cargando miembros.', 'error'))
      .finally(() => setLoading(false))
  }, [workspace?.id])

  async function handleRoleChange(memberId: string, newRole: Role) {
    if (!workspace) return
    setUpdatingRole(memberId)
    try {
      await api.workspaces.updateMemberRole(workspace.id, memberId, newRole)
      setMembers(prev =>
        prev.map(m => (m.userId === memberId ? { ...m, role: newRole } : m)),
      )
      toast('Rol actualizado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  async function handleRemove(memberId: string) {
    if (!workspace) return
    setRemovingId(memberId)
    try {
      await api.workspaces.removeMember(workspace.id, memberId)
      setMembers(prev => prev.filter(m => m.userId !== memberId))
      toast('Miembro eliminado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setRemovingId(null)
    }
  }

  function handleMemberCreated(member: ApiWorkspaceMember) {
    setMembers(prev => {
      if (prev.some(m => m.userId === member.userId)) return prev
      return [...prev, member]
    })
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Seleccioná un workspace primero.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Miembros del workspace</h1>
          <p className="text-sm text-gray-500">
            Gestioná quién tiene acceso a{' '}
            <span className="font-medium text-gray-700">{workspace.name}</span>.
          </p>
        </div>

        {/* Current members */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {members.map(member => {
              const isMe = member.userId === currentUser?.id
              const role = member.role as Role
              const isRemoving = removingId === member.userId
              const isUpdating = updatingRole === member.userId

              return (
                <div
                  key={member.userId}
                  className={`flex items-center gap-3 px-4 py-3.5 ${isMe ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'} transition-colors`}
                >
                  {/* Avatar */}
                  <UserAvatar user={member.user} />

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {member.user.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                          Vos
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{member.user.email}</p>
                  </div>

                  {/* Role — dropdown if admin, badge otherwise */}
                  <div className="shrink-0">
                    {isAdmin && !isMe ? (
                      <div className="relative">
                        <RoleDropdown
                          value={role}
                          onChange={r => handleRoleChange(member.userId, r)}
                          disabled={isUpdating}
                        />
                        {isUpdating && (
                          <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />
                        )}
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[role]}`}
                      >
                        {ROLE_ICON[role]}
                        {ROLE_LABEL[role]}
                      </span>
                    )}
                  </div>

                  {/* Remove button */}
                  {isAdmin && !isMe && (
                    <button
                      onClick={() => handleRemove(member.userId)}
                      disabled={isRemoving}
                      title="Eliminar miembro"
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                    >
                      {isRemoving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Add member section — only for admins */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Agregar miembro</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['registered', 'new'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'registered' ? 'Usuario registrado' : 'Usuario nuevo'}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'registered' ? (
                <InviteRegisteredTab
                  workspaceId={workspace.id}
                  members={members}
                  onInvited={() => {
                    // Refresh member list after invite
                    api.workspaces
                      .get(workspace.id)
                      .then(({ workspace: ws }) => setMembers(ws.members as ApiWorkspaceMember[]))
                      .catch(() => {})
                  }}
                />
              ) : (
                <InviteNewUserTab workspaceId={workspace.id} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
