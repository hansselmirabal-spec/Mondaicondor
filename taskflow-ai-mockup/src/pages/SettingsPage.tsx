import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Settings, Bell, Users, Shield, Palette,
  ArrowLeft, Save, Loader2, Trash2, ChevronRight, Check
} from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import type { ApiUserPreferences } from '@/lib/api'
import { toast } from '@/components/ui/Toast'

type Section = 'general' | 'notifications' | 'members' | 'permissions' | 'appearance'

const SECTIONS: { id: Section; icon: React.ReactNode; label: string; description: string }[] = [
  { id: 'general',       icon: <Settings className="w-4 h-4" />,  label: 'General',         description: 'Nombre y descripción del tablero' },
  { id: 'notifications', icon: <Bell className="w-4 h-4" />,      label: 'Notificaciones',  description: 'Alertas por correo y en la app' },
  { id: 'members',       icon: <Users className="w-4 h-4" />,     label: 'Miembros',        description: 'Roles y accesos' },
  { id: 'permissions',   icon: <Shield className="w-4 h-4" />,    label: 'Permisos',        description: 'Qué puede hacer cada rol' },
  { id: 'appearance',    icon: <Palette className="w-4 h-4" />,   label: 'Apariencia',      description: 'Color de perfil y preferencias' },
]

const ROLE_MATRIX = [
  { action: 'Ver tableros y tareas',          admin: true,  member: true,  viewer: true  },
  { action: 'Agregar y editar tareas',        admin: true,  member: true,  viewer: false },
  { action: 'Eliminar tareas',                admin: true,  member: true,  viewer: false },
  { action: 'Crear y editar grupos',          admin: true,  member: true,  viewer: false },
  { action: 'Eliminar grupos',                admin: true,  member: false, viewer: false },
  { action: 'Crear tableros',                 admin: true,  member: true,  viewer: false },
  { action: 'Editar tableros',                admin: true,  member: true,  viewer: false },
  { action: 'Eliminar tableros',              admin: true,  member: false, viewer: false },
  { action: 'Gestionar automaciones',         admin: true,  member: true,  viewer: false },
  { action: 'Invitar miembros',               admin: true,  member: true,  viewer: false },
  { action: 'Cambiar roles',                  admin: true,  member: false, viewer: false },
  { action: 'Eliminar miembros',              admin: true,  member: false, viewer: false },
  { action: 'Editar workspace',               admin: true,  member: false, viewer: false },
  { action: 'Eliminar workspace',             admin: true,  member: false, viewer: false },
  { action: 'Gestionar estados del workspace',admin: true,  member: true,  viewer: false },
]

const AVATAR_COLORS = [
  '#e2445c', '#579bfc', '#00c875', '#fdab3d',
  '#a25ddc', '#00c2cd', '#ff7575', '#037f4c',
  '#ff642e', '#7e3af2', '#6366f1', '#0891b2',
]

export function SettingsPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { boards, patchBoard, removeBoard, apiUsers } = useBoardStore(s => ({
    boards: s.boards,
    patchBoard: s.patchBoard,
    removeBoard: s.removeBoard,
    apiUsers: s.apiUsers,
  }))
  const currentUser = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)

  const board = boards.find(b => b.id === boardId)

  const [active, setActive] = useState<Section>('general')

  // General
  const [boardName, setBoardName] = useState(board?.name ?? '')
  const [boardDesc, setBoardDesc] = useState(board?.description ?? '')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false)
  const [deletingBoard, setDeletingBoard] = useState(false)

  // Notifications
  const [prefs, setPrefs] = useState<ApiUserPreferences | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Appearance
  const [selectedColor, setSelectedColor] = useState(currentUser?.color ?? '#6366f1')
  const [savingColor, setSavingColor] = useState(false)

  useEffect(() => {
    if (board) {
      setBoardName(board.name)
      setBoardDesc(board.description ?? '')
    }
  }, [board?.id])

  useEffect(() => {
    if (active !== 'notifications' || prefs) return
    setLoadingPrefs(true)
    api.users.getPreferences()
      .then(({ preferences }) => setPrefs(preferences ?? { theme: 'light', language: 'es', emailNotifications: true }))
      .catch(() => toast('Error cargando preferencias.', 'error'))
      .finally(() => setLoadingPrefs(false))
  }, [active])

  useEffect(() => {
    setSelectedColor(currentUser?.color ?? '#6366f1')
  }, [currentUser?.color])

  async function saveGeneral() {
    if (!boardId || !boardName.trim()) return
    setSavingGeneral(true)
    try {
      await api.boards.update(boardId, { name: boardName.trim(), description: boardDesc.trim() || null })
      patchBoard(boardId, { name: boardName.trim(), description: boardDesc.trim() })
      toast('Tablero actualizado.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
    } finally {
      setSavingGeneral(false)
    }
  }

  async function deleteBoard() {
    if (!boardId) return
    setDeletingBoard(true)
    try {
      await api.boards.delete(boardId)
      removeBoard(boardId)
      navigate('/boards')
      toast('Tablero eliminado.', 'success')
    } catch {
      toast('Error al eliminar el tablero.', 'error')
      setDeletingBoard(false)
    }
  }

  async function togglePref(key: keyof ApiUserPreferences, value: boolean | string) {
    if (!prefs) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSavingPrefs(true)
    try {
      const { preferences } = await api.users.updatePreferences({ [key]: value })
      setPrefs(preferences)
    } catch {
      setPrefs(prefs)
      toast('Error al guardar preferencia.', 'error')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function saveColor() {
    setSavingColor(true)
    try {
      const { user } = await api.users.updateProfile({ color: selectedColor })
      setUser(user)
      toast('Color actualizado.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
    } finally {
      setSavingColor(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/boards/${boardId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al tablero
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">{board?.name ?? 'Configuración'}</span>
      </div>

      <div className="flex max-w-5xl mx-auto gap-6 p-6">
        {/* Left nav */}
        <nav className="w-52 shrink-0 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pb-2">Secciones</p>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                active === s.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={active === s.id ? 'text-blue-600' : 'text-gray-400'}>{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
              {active === s.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-400" />}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* GENERAL */}
          {active === 'general' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-0.5">General</h2>
                  <p className="text-xs text-gray-500">Nombre y descripción del tablero.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Nombre del tablero <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={boardName}
                      onChange={e => setBoardName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Descripción</label>
                    <textarea
                      value={boardDesc}
                      onChange={e => setBoardDesc(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Descripción del tablero..."
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={saveGeneral}
                    disabled={savingGeneral || !boardName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {savingGeneral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Guardar cambios
                  </button>
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-xl border border-red-200 p-6 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-red-700">Zona de peligro</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Esta acción elimina el tablero y todas sus tareas. Es irreversible.</p>
                </div>
                {confirmDeleteBoard ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">¿Estás seguro?</span>
                    <button
                      onClick={() => setConfirmDeleteBoard(false)}
                      className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={deleteBoard}
                      disabled={deletingBoard}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      {deletingBoard && <Loader2 className="w-3 h-3 animate-spin" />}
                      Sí, eliminar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteBoard(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar tablero
                  </button>
                )}
              </div>
            </>
          )}

          {/* NOTIFICATIONS */}
          {active === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-0.5">Notificaciones</h2>
                <p className="text-xs text-gray-500">Controlá cómo y cuándo recibís alertas.</p>
              </div>

              {loadingPrefs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : prefs ? (
                <div className="space-y-4">
                  <ToggleRow
                    label="Notificaciones por correo"
                    description="Recibí un resumen diario de actividad en tu casilla."
                    checked={prefs.emailNotifications}
                    loading={savingPrefs}
                    onChange={v => togglePref('emailNotifications', v)}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">No se pudieron cargar las preferencias.</p>
              )}
            </div>
          )}

          {/* MEMBERS */}
          {active === 'members' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-0.5">Miembros del workspace</h2>
                  <p className="text-xs text-gray-500">{apiUsers.length} {apiUsers.length === 1 ? 'miembro' : 'miembros'} activos.</p>
                </div>
                <button
                  onClick={() => navigate('/members')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  Gestionar usuarios
                </button>
              </div>

              <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {apiUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin miembros cargados.</p>
                ) : apiUsers.slice(0, 8).map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    {u.id === currentUser?.id && (
                      <span className="text-xs text-gray-400 shrink-0">(vos)</span>
                    )}
                  </div>
                ))}
                {apiUsers.length > 8 && (
                  <div className="px-4 py-3 text-center">
                    <button onClick={() => navigate('/members')} className="text-xs text-blue-600 hover:underline">
                      Ver los {apiUsers.length - 8} más →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PERMISSIONS */}
          {active === 'permissions' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-0.5">Permisos por rol</h2>
                <p className="text-xs text-gray-500">Qué puede hacer cada rol en el workspace.</p>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-purple-600 uppercase tracking-wide">Admin</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wide">Miembro</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Visualizador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ROLE_MATRIX.map(row => (
                      <tr key={row.action} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-gray-700">{row.action}</td>
                        <td className="px-4 py-2.5 text-center">
                          {row.admin ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg leading-none">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {row.member ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg leading-none">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {row.viewer ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg leading-none">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {active === 'appearance' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-0.5">Apariencia</h2>
                <p className="text-xs text-gray-500">Personalizá tu perfil visual dentro de la plataforma.</p>
              </div>

              {/* Avatar preview */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md transition-colors duration-200"
                  style={{ backgroundColor: selectedColor }}
                >
                  {currentUser?.initials ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{currentUser?.name}</p>
                  <p className="text-xs text-gray-400">{currentUser?.email}</p>
                </div>
              </div>

              {/* Language */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Idioma de la interfaz</p>
                <select
                  value={prefs?.language ?? 'es'}
                  onChange={e => togglePref('language', e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              {/* Color picker */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Color del avatar</p>
                <div className="flex flex-wrap gap-2.5">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                        selectedColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={saveColor}
                  disabled={savingColor || selectedColor === currentUser?.color}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingColor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar color
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  loading: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, checked, loading, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => !loading && onChange(!checked)}
        disabled={loading}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
