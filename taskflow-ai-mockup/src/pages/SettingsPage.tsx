import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Settings, Bell, Users, Shield, Palette, ListChecks,
  ArrowLeft, Save, Loader2, Trash2, ChevronRight, Check,
  Plus, X, GripVertical, AlertCircle, RotateCcw, Pencil
} from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import type { ApiUserPreferences } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import { toMockBoard } from '@/lib/adapters'
import { isBoardAdminClient } from '@/lib/permissions'
import type { CustomFieldDefinition, CustomFieldType, MockBoard } from '@/types'

type Section = 'general' | 'notifications' | 'members' | 'permissions' | 'appearance' | 'customFields'

const SECTIONS: { id: Section; icon: React.ReactNode; label: string; description: string }[] = [
  { id: 'general',       icon: <Settings className="w-4 h-4" />,  label: 'General',         description: 'Nombre y descripción del tablero' },
  { id: 'notifications', icon: <Bell className="w-4 h-4" />,      label: 'Notificaciones',  description: 'Alertas por correo y en la app' },
  { id: 'members',       icon: <Users className="w-4 h-4" />,     label: 'Miembros',        description: 'Roles y accesos' },
  { id: 'permissions',   icon: <Shield className="w-4 h-4" />,    label: 'Permisos',        description: 'Qué puede hacer cada rol' },
  { id: 'appearance',    icon: <Palette className="w-4 h-4" />,   label: 'Apariencia',      description: 'Color de perfil y preferencias' },
  { id: 'customFields',  icon: <ListChecks className="w-4 h-4" />, label: 'Campos personalizados', description: 'Columnas extra para las tareas de este tablero' },
]

const PRESET_COLORS = [
  '#c4c4c4', '#e2445c', '#579bfc', '#a25ddc', '#bb3354',
  '#00c875', '#00c2cd', '#fdab3d', '#e2e253', '#333333',
  '#ff7575', '#9aadbd', '#66ccff', '#ff642e', '#7e3af2',
]

const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  DATE: 'Fecha',
  SELECT: 'Selección',
  CHECKBOX: 'Casilla',
}

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
  const { boards, setBoards, patchBoard, removeBoard, apiUsers, workspaces } = useBoardStore(s => ({
    boards: s.boards,
    setBoards: s.setBoards,
    patchBoard: s.patchBoard,
    removeBoard: s.removeBoard,
    apiUsers: s.apiUsers,
    workspaces: s.workspaces,
  }))
  const currentUser = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)

  const board = boards.find(b => b.id === boardId)
  const isAdmin = isBoardAdminClient(board, currentUser, workspaces)

  const [active, setActive] = useState<Section>('general')

  // SettingsPage is a standalone route — if the user lands here directly
  // (not via BoardHeader's "Configuración" menu, which implies BoardPage
  // already loaded the board), fetch it so board.boardMembers/role is
  // available for the admin gate below.
  useEffect(() => {
    if (!boardId || board) return
    api.boards.get(boardId)
      .then(({ board: apiBoard }) => {
        const mockBoard = toMockBoard(apiBoard)
        setBoards((prev: MockBoard[]) => prev.some(b => b.id === boardId) ? prev : [...prev, mockBoard])
      })
      .catch(() => {})
  }, [boardId, board, setBoards])

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
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={active === s.id ? 'text-primary-600' : 'text-gray-400'}>{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
              {active === s.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-400" />}
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Descripción</label>
                    <textarea
                      value={boardDesc}
                      onChange={e => setBoardDesc(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Descripción del tablero..."
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={saveGeneral}
                    disabled={savingGeneral || !boardName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-200 text-white text-sm font-medium rounded-lg transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
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
                    <button onClick={() => navigate('/members')} className="text-xs text-primary-600 hover:underline">
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
                      <th className="px-4 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wide">Miembro</th>
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
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-200 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingColor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar color
                </button>
              </div>
            </div>
          )}

          {/* CUSTOM FIELDS */}
          {active === 'customFields' && boardId && (
            <CustomFieldsSection boardId={boardId} isAdmin={isAdmin} />
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
          checked ? 'bg-primary-600' : 'bg-gray-200'
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

// ── Campos personalizados ───────────────────────────────────────────────────

interface CustomFieldsSectionProps {
  boardId: string
  isAdmin: boolean
}

interface DraftOption {
  label: string
  color: string
}

interface EditingField {
  id: string
  label: string
  type: CustomFieldType
  hasValues: boolean
}

const CUSTOM_FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX']

function CustomFieldsSection({ boardId, isAdmin }: CustomFieldsSectionProps) {
  const { customFieldDefinitions, setCustomFieldDefinitions } = useBoardStore(s => ({
    customFieldDefinitions: s.customFieldDefinitions,
    setCustomFieldDefinitions: s.setCustomFieldDefinitions,
  }))
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<CustomFieldType>('TEXT')
  const [newOptions, setNewOptions] = useState<DraftOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionColor, setNewOptionColor] = useState(PRESET_COLORS[2])
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<EditingField | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editOptionLabel, setEditOptionLabel] = useState('')
  const [editOptionColor, setEditOptionColor] = useState(PRESET_COLORS[2])
  const [addingOption, setAddingOption] = useState(false)
  const [archivingOptionId, setArchivingOptionId] = useState<string | null>(null)

  const [archivingFieldId, setArchivingFieldId] = useState<string | null>(null)
  const [unarchivingFieldId, setUnarchivingFieldId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const activeFields = customFieldDefinitions.filter(f => !f.archivedAt)
  const archivedFields = customFieldDefinitions.filter(f => f.archivedAt)

  async function refresh() {
    const { customFieldDefinitions: defs } = await api.boards.listCustomFields(boardId, true)
    setCustomFieldDefinitions(defs)
  }

  useEffect(() => {
    setLoading(true)
    refresh()
      .catch(() => toast('Error cargando campos personalizados.', 'error'))
      .finally(() => setLoading(false))
  }, [boardId])

  function resetNewForm() {
    setShowNewForm(false)
    setNewLabel('')
    setNewType('TEXT')
    setNewOptions([])
    setNewOptionLabel('')
    setNewOptionColor(PRESET_COLORS[2])
  }

  function addDraftOption() {
    if (!newOptionLabel.trim()) return
    setNewOptions([...newOptions, { label: newOptionLabel.trim(), color: newOptionColor }])
    setNewOptionLabel('')
  }

  function removeDraftOption(idx: number) {
    setNewOptions(newOptions.filter((_, i) => i !== idx))
  }

  async function handleCreate() {
    if (!newLabel.trim()) return
    setCreating(true)
    try {
      await api.boards.createCustomField(boardId, {
        label: newLabel.trim(),
        type: newType,
        config: newType === 'SELECT' && newOptions.length > 0 ? { options: newOptions } : undefined,
      })
      await refresh()
      resetNewForm()
      toast('Campo creado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editing.label.trim()) return
    setEditSaving(true)
    try {
      await api.boards.updateCustomField(boardId, editing.id, {
        label: editing.label.trim(),
        type: editing.type,
      })
      await refresh()
      setEditing(null)
      toast('Campo actualizado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleAddOptionToEditing() {
    if (!editing || !editOptionLabel.trim()) return
    setAddingOption(true)
    try {
      await api.boards.updateCustomField(boardId, editing.id, {
        config: { options: [{ label: editOptionLabel.trim(), color: editOptionColor }] },
      })
      await refresh()
      setEditOptionLabel('')
      toast('Opción agregada.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setAddingOption(false)
    }
  }

  async function handleArchiveOption(fieldId: string, optionId: string) {
    setArchivingOptionId(optionId)
    try {
      await api.boards.archiveCustomFieldOption(boardId, fieldId, optionId)
      await refresh()
      toast('Opción archivada.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setArchivingOptionId(null)
    }
  }

  async function handleArchiveField(fieldId: string) {
    setArchivingFieldId(fieldId)
    try {
      await api.boards.archiveCustomField(boardId, fieldId)
      await refresh()
      toast('Campo archivado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setArchivingFieldId(null)
    }
  }

  async function handleUnarchiveField(fieldId: string) {
    setUnarchivingFieldId(fieldId)
    try {
      await api.boards.unarchiveCustomField(boardId, fieldId)
      await refresh()
      toast('Campo desarchivado.', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setUnarchivingFieldId(null)
    }
  }

  async function moveField(idx: number, dir: -1 | 1) {
    const swap = idx + dir
    if (swap < 0 || swap >= activeFields.length) return
    const next = [...activeFields]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setCustomFieldDefinitions([...next, ...archivedFields])
    setReordering(true)
    try {
      await api.boards.reorderCustomFields(boardId, next.map(f => f.id))
    } catch {
      toast('Error al reordenar.', 'error')
      await refresh()
    } finally {
      setReordering(false)
    }
  }

  function startEdit(field: CustomFieldDefinition) {
    setEditing({ id: field.id, label: field.label, type: field.type, hasValues: field.hasValues })
    setEditOptionLabel('')
    setEditOptionColor(PRESET_COLORS[2])
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-400 text-center py-4">Cargando campos personalizados...</p>
      </div>
    )
  }

  const isEmpty = activeFields.length === 0 && archivedFields.length === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-0.5">Campos personalizados</h2>
          <p className="text-xs text-gray-500">Columnas extra para las tareas de este tablero.</p>
        </div>
        {isAdmin && !isEmpty && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo campo
          </button>
        )}
      </div>

      {isEmpty && !showNewForm ? (
        <div className="px-6 py-10 text-center space-y-3">
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Todavía no hay campos personalizados. Ejemplos: Proveedor, Monto estimado, Ticket relacionado, Impacto (1-5).
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {activeFields.map((field, idx) => (
            <div key={field.id} className="px-4 py-3">
              {editing?.id === field.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      autoFocus
                      value={editing.label}
                      onChange={e => setEditing({ ...editing, label: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 min-w-[140px] px-2 py-1 border border-primary-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                    <select
                      value={editing.type}
                      disabled={editing.hasValues}
                      onChange={e => setEditing({ ...editing, type: e.target.value as CustomFieldType })}
                      className="px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      {CUSTOM_FIELD_TYPES.map(t => (
                        <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveEdit}
                        disabled={editSaving}
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
                  {editing.hasValues && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      No se puede cambiar el tipo: este campo ya tiene valores cargados.
                    </p>
                  )}

                  {editing.type === 'SELECT' && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opciones</p>
                      <div className="space-y-1.5">
                        {(field.config.options ?? []).filter(o => !o.archivedAt).map(opt => (
                          <div key={opt.id} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-gray-100">
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                            <span className="flex-1 text-sm text-gray-700">{opt.label}</span>
                            <button
                              onClick={() => handleArchiveOption(field.id, opt.id)}
                              disabled={archivingOptionId === opt.id}
                              title="Archivar opción"
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <input
                          value={editOptionLabel}
                          onChange={e => setEditOptionLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddOptionToEditing() }}
                          placeholder="Nueva opción..."
                          className="flex-1 min-w-[120px] px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditOptionColor(c)}
                              className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${editOptionColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleAddOptionToEditing}
                          disabled={!editOptionLabel.trim() || addingOption}
                          className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-200 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0 || reordering}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                        title="Subir"
                      >
                        <GripVertical className="w-3 h-3 rotate-[270deg]" />
                      </button>
                      <button
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === activeFields.length - 1 || reordering}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                        title="Bajar"
                      >
                        <GripVertical className="w-3 h-3 rotate-90" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => isAdmin && startEdit(field)}
                    disabled={!isAdmin}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    <span className="text-sm font-medium text-gray-800 truncate">{field.label}</span>
                    <span className="text-[10px] font-normal text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">
                      {CUSTOM_FIELD_TYPE_LABELS[field.type]}
                    </span>
                    {field.type === 'SELECT' && (field.config.options ?? []).filter(o => !o.archivedAt).length > 0 && (
                      <span className="flex items-center gap-1 shrink-0">
                        {(field.config.options ?? []).filter(o => !o.archivedAt).slice(0, 5).map(o => (
                          <span key={o.id} className="w-3 h-3 rounded-full" style={{ backgroundColor: o.color }} title={o.label} />
                        ))}
                      </span>
                    )}
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(field)}
                        title="Editar"
                        className="p-1.5 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchiveField(field.id)}
                        disabled={archivingFieldId === field.id}
                        title="Archivar campo"
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* New field form */}
          {showNewForm && (
            <div className="px-4 py-3 bg-primary-50 border-t border-primary-100 space-y-3">
              <p className="text-xs font-semibold text-primary-700">Nuevo campo</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  autoFocus
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') resetNewForm() }}
                  placeholder="Nombre del campo..."
                  className="flex-1 min-w-[140px] px-2 py-1 border border-primary-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as CustomFieldType)}
                  className="px-2 py-1 border border-primary-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {CUSTOM_FIELD_TYPES.map(t => (
                    <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {newType === 'SELECT' && (
                <div className="bg-white rounded-lg p-3 space-y-2 border border-primary-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opciones</p>
                  {newOptions.length > 0 && (
                    <div className="space-y-1.5">
                      {newOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                          <span className="flex-1 text-sm text-gray-700">{opt.label}</span>
                          <button onClick={() => removeDraftOption(i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={newOptionLabel}
                      onChange={e => setNewOptionLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftOption() } }}
                      placeholder="Nueva opción..."
                      className="flex-1 min-w-[120px] px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewOptionColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${newOptionColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={addDraftOption}
                      disabled={!newOptionLabel.trim()}
                      className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newLabel.trim() || creating}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-200 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Crear
                </button>
                <button
                  onClick={resetNewForm}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Archived */}
          <div className="px-4 py-2.5">
            <button
              onClick={() => setShowArchived(o => !o)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showArchived ? 'Ocultar' : 'Ver'} archivados ({archivedFields.length})
            </button>
          </div>
          {showArchived && archivedFields.map(field => (
            <div key={field.id} className="px-4 py-3 flex items-center gap-3 bg-gray-50">
              <span className="flex-1 text-sm text-gray-500 truncate">{field.label}</span>
              <span className="text-[10px] font-normal text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">
                {CUSTOM_FIELD_TYPE_LABELS[field.type]}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleUnarchiveField(field.id)}
                  disabled={unarchivingFieldId === field.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Desarchivar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
