import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck, Plus, Pencil, Trash2, X, Loader2, AlertCircle, KeyRound, Copy, Check } from 'lucide-react'
import { api } from '@/lib/api'
import type { SystemAdminUser } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { copyToClipboard } from '@/lib/utils'

// ---- helpers ---------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---- Avatar ----------------------------------------------------------------

interface AvatarProps {
  initials: string
  color: string
  size?: 'sm' | 'md'
}

function Avatar({ initials, color, size = 'md' }: AvatarProps) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

// ---- Modal base ------------------------------------------------------------

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ---- Inline error ----------------------------------------------------------

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="w-3 h-3 shrink-0" />
      {message}
    </p>
  )
}

// ---- Create modal ----------------------------------------------------------

interface CreateModalProps {
  onClose: () => void
  onCreated: (user: SystemAdminUser) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }

    setLoading(true)
    try {
      const { user } = await api.systemAdmin.createUser({ name: name.trim(), email: email.trim(), password })
      onCreated(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Ana García"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="ana@empresa.com"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña inicial</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Mínimo 8 caracteres"
            required
          />
          <p className="mt-1 text-xs text-gray-400">El usuario deberá cambiarla en su próximo inicio de sesión.</p>
        </div>

        {error && <FieldError message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Crear usuario
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Edit modal ------------------------------------------------------------

interface EditModalProps {
  user: SystemAdminUser
  onClose: () => void
  onUpdated: (user: SystemAdminUser) => void
}

function EditModal({ user, onClose, onUpdated }: EditModalProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }

    const data: { name?: string; email?: string } = {}
    if (name.trim() !== user.name) data.name = name.trim()
    if (email.trim() !== user.email) data.email = email.trim()

    if (Object.keys(data).length === 0) { onClose(); return }

    setLoading(true)
    try {
      const { user: updated } = await api.systemAdmin.updateUser(user.id, data)
      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Editar usuario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {error && <FieldError message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Reset password modal ---------------------------------------------------

interface ResetPasswordModalProps {
  user: SystemAdminUser
  isSelf: boolean
  onClose: () => void
}

function ResetPasswordModal({ user, isSelf, onClose }: ResetPasswordModalProps) {
  const [phase, setPhase] = useState<'confirm' | 'revealed'>('confirm')
  const [tempPassword, setTempPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setError('')
    setLoading(true)
    try {
      const { tempPassword } = await api.systemAdmin.resetPassword(user.id)
      setTempPassword(tempPassword)
      setPhase('revealed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    // Use the shared helper — it handles non-secure (HTTP) contexts where
    // navigator.clipboard is unavailable, which is the case on QAS/PROD.
    copyToClipboard(tempPassword)
    setCopied(true)
  }

  function handleClose() {
    setTempPassword('')
    onClose()
  }

  return (
    <Modal title="Resetear contraseña" onClose={handleClose}>
      {phase === 'confirm' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Avatar initials={user.initials} color={user.color} size="sm" />
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Se generará una contraseña temporal y se cerrarán todas las sesiones activas de este usuario. Deberá cambiarla en su próximo inicio de sesión.
          </p>
          {isSelf && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg ring-1 ring-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Estás restableciendo tu propia contraseña. Se cerrará tu sesión y deberás volver a iniciar sesión con la contraseña temporal.
              </p>
            </div>
          )}

          {error && <FieldError message={error} />}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Resetear contraseña
            </button>
          </div>
        </div>
      )}

      {phase === 'revealed' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Contraseña temporal generada. Cópiala ahora — no volverá a mostrarse.
          </p>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <code className="flex-1 text-sm font-mono text-gray-900 select-all">{tempPassword}</code>
            <button
              onClick={handleCopy}
              title="Copiar"
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---- Delete confirm modal --------------------------------------------------

interface DeleteModalProps {
  user: SystemAdminUser
  onClose: () => void
  onDeleted: (id: string) => void
}

function DeleteModal({ user, onClose, onDeleted }: DeleteModalProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setError('')
    setLoading(true)
    try {
      await api.systemAdmin.deleteUser(user.id)
      onDeleted(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el usuario')
      setLoading(false)
    }
  }

  return (
    <Modal title="Eliminar usuario" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
          <Avatar initials={user.initials} color={user.color} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Esta acción es <span className="font-semibold text-gray-900">permanente</span>. Se eliminará el usuario y todos sus datos asociados.
        </p>

        {error && <FieldError message={error} />}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---- Main page -------------------------------------------------------------

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: SystemAdminUser }
  | { type: 'delete'; user: SystemAdminUser }
  | { type: 'reset'; user: SystemAdminUser }

export function SystemAdminPage() {
  const currentUser = useAuthStore(state => state.user)
  const [users, setUsers] = useState<SystemAdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  useEffect(() => {
    if (!currentUser?.isAppAdmin) return
    api.systemAdmin.listUsers()
      .then(({ users }) => setUsers(users))
      .catch(err => setFetchError(err instanceof Error ? err.message : 'Error al cargar usuarios'))
      .finally(() => setLoading(false))
  }, [currentUser?.isAppAdmin])

  if (!currentUser?.isAppAdmin) return <Navigate to="/boards" replace />

  function handleCreated(user: SystemAdminUser) {
    setUsers(prev => [...prev, user])
    setModal({ type: 'none' })
  }

  function handleUpdated(user: SystemAdminUser) {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u))
    setModal({ type: 'none' })
  }

  function handleDeleted(id: string) {
    setUsers(prev => prev.filter(u => u.id !== id))
    setModal({ type: 'none' })
  }

  async function handleToggleAppAdmin(u: SystemAdminUser) {
    const grant = !u.isAppAdmin
    const msg = grant
      ? `¿Hacer a ${u.name} admin de sistema? Podrá ver y gestionar todo en la app.`
      : `¿Quitarle a ${u.name} el rol de admin de sistema?`
    if (!window.confirm(msg)) return
    try {
      const { user } = await api.systemAdmin.setAppAdmin(u.id, grant)
      setUsers(prev => prev.map(x => x.id === user.id ? user : x))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al cambiar el rol')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h1 className="text-base font-semibold text-gray-900">Administración del sistema</h1>
              <p className="text-xs text-gray-500">Gestión global de usuarios de la aplicación</p>
            </div>
          </div>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Cargando usuarios...</span>
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-sm text-gray-400">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={u.initials} color={u.color} size="sm" />
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.isAppAdmin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium ring-1 ring-indigo-200">
                            <ShieldCheck className="w-3 h-3" />
                            Admin de sistema
                          </span>
                        )}
                        {u.mustChangePassword && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium ring-1 ring-amber-200">
                            Cambiar clave
                          </span>
                        )}
                        {!u.isAppAdmin && !u.mustChangePassword && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleAppAdmin(u)}
                            title={u.isAppAdmin ? 'Quitar admin de sistema' : 'Hacer admin de sistema'}
                            className={`p-1.5 rounded-lg transition-colors hover:bg-indigo-50 ${u.isAppAdmin ? 'text-indigo-500 hover:text-indigo-700' : 'text-gray-400 hover:text-indigo-600'}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ type: 'reset', user: u })}
                          title="Resetear contraseña"
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'edit', user: u })}
                          title="Editar"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', user: u })}
                          title="Eliminar"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal.type === 'create' && (
        <CreateModal onClose={() => setModal({ type: 'none' })} onCreated={handleCreated} />
      )}
      {modal.type === 'edit' && (
        <EditModal user={modal.user} onClose={() => setModal({ type: 'none' })} onUpdated={handleUpdated} />
      )}
      {modal.type === 'delete' && (
        <DeleteModal user={modal.user} onClose={() => setModal({ type: 'none' })} onDeleted={handleDeleted} />
      )}
      {modal.type === 'reset' && (
        <ResetPasswordModal
          user={modal.user}
          isSelf={modal.user.id === currentUser?.id}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
