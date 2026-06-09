import { useState, useEffect } from 'react'
import { Loader2, UserPlus, Pencil, Trash2, Shield, User, Eye, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api, type ApiWorkspaceMember } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'

type Role = 'ADMIN' | 'MEMBER' | 'VIEWER'

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', MEMBER: 'Miembro', VIEWER: 'Visualizador' }
const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MEMBER: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-gray-100 text-gray-600',
}
const ROLE_ICON: Record<Role, React.ReactNode> = {
  ADMIN: <Shield className="w-3 h-3" />,
  MEMBER: <User className="w-3 h-3" />,
  VIEWER: <Eye className="w-3 h-3" />,
}

const COLORS = ['#e2445c', '#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#00c2cd', '#ff7575', '#037f4c']

interface FormState {
  name: string
  email: string
  password: string
  color: string
  role: Role
}

const EMPTY_FORM: FormState = { name: '', email: '', password: '', color: COLORS[0], role: 'MEMBER' }

export function MembersPage() {
  const currentUser = useAuthStore(state => state.user)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [members, setMembers] = useState<ApiWorkspaceMember[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [editingMember, setEditingMember] = useState<ApiWorkspaceMember | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { workspaces } = await api.workspaces.list()
        const ws = workspaces[0]
        if (!ws) return
        setWorkspaceId(ws.id)

        const { members: list } = await api.admin.listUsers(ws.id)
        setMembers(list)
        setIsAdmin(true) // success means the current user is admin (backend enforces this)
      } catch {
        // non-admin: fallback to basic workspace data
        try {
          const { workspaces } = await api.workspaces.list()
          const ws = workspaces[0]
          if (!ws) return
          setWorkspaceId(ws.id)
          const { workspace } = await api.workspaces.get(ws.id)
          setMembers(workspace.members as ApiWorkspaceMember[])
        } catch { /* ignore */ }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowCreate(true)
  }

  function openEdit(member: ApiWorkspaceMember) {
    setForm({
      name: member.user.name,
      email: member.user.email,
      password: '',
      color: member.user.color,
      role: member.role as Role,
    })
    setFormError(null)
    setEditingMember(member)
  }

  async function handleCreate() {
    if (!workspaceId) return
    setSubmitting(true)
    setFormError(null)
    try {
      const { member } = await api.admin.createUser(workspaceId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setMembers(prev => [...prev, member])
      setShowCreate(false)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit() {
    if (!workspaceId || !editingMember) return
    setSubmitting(true)
    setFormError(null)
    try {
      const { member } = await api.admin.updateUser(workspaceId, editingMember.userId, {
        name: form.name.trim(),
        email: form.email.trim(),
        color: form.color,
        role: editingMember.userId !== currentUser?.id ? form.role : undefined,
      })
      setMembers(prev => prev.map(m => (m.userId === editingMember.userId ? { ...m, ...member } : m)))
      setEditingMember(null)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!workspaceId || !confirmDeleteId) return
    setDeleting(true)
    try {
      await api.admin.deleteUser(workspaceId, confirmDeleteId)
      setMembers(prev => prev.filter(m => m.userId !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = members.filter(m =>
    m.user.name.toLowerCase().includes(search.toLowerCase()) ||
    m.user.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
            <p className="text-sm text-gray-500 mt-0.5">{members.length} {members.length === 1 ? 'usuario' : 'usuarios'}</p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo usuario
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_1fr_140px_100px] gap-4 px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="w-9" />
            <div>Nombre</div>
            <div>Email</div>
            <div>Rol</div>
            {isAdmin && <div className="text-right">Acciones</div>}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                {search ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios todavía.'}
              </div>
            )}
            {filtered.map(member => {
              const isMe = member.userId === currentUser?.id
              const role = member.role as Role
              const isConfirming = confirmDeleteId === member.userId

              return (
                <div
                  key={member.userId}
                  className={`grid grid-cols-[auto_1fr_1fr_140px_100px] gap-4 items-center px-5 py-3.5 transition-colors ${isMe ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: member.user.color }}
                  >
                    {member.user.initials}
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{member.user.name}</span>
                      {isMe && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">vos</span>}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="text-sm text-gray-500 truncate" title={member.user.email}>{member.user.email}</div>

                  {/* Role badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[role]}`}>
                      {ROLE_ICON[role]}
                      {ROLE_LABEL[role]}
                    </span>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-1">
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 whitespace-nowrap">¿Eliminar?</span>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                          >
                            No
                          </button>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(member)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!isMe && (
                            <button
                              onClick={() => setConfirmDeleteId(member.userId)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo usuario" size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ana García"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ana@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="MEMBER">Miembro</option>
              <option value="VIEWER">Visualizador</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Color de avatar</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.email.trim() || form.password.length < 8 || submitting}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear usuario
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editingMember} onClose={() => setEditingMember(null)} title="Editar usuario" size="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {editingMember?.userId !== currentUser?.id && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="MEMBER">Miembro</option>
                <option value="VIEWER">Visualizador</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Color de avatar</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditingMember(null)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button
              onClick={handleEdit}
              disabled={!form.name.trim() || !form.email.trim() || submitting}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
