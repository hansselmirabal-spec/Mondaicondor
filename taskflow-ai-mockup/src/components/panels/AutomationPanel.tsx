import { X, Zap, ArrowRight, ToggleLeft, ToggleRight, Plus, Trash2, Bell, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { api } from '@/lib/api'
import type { ApiAutomation } from '@/lib/api'
import { useBoardStore } from '@/store/boardStore'

const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: 'task.completed',        label: 'Cuando una tarea pase a Completado' },
  { value: 'task.blocked',          label: 'Cuando una tarea pase a Bloqueado' },
  { value: 'task.status_changed',   label: 'Cuando una tarea cambie de estado' },
  { value: 'task.priority_changed', label: 'Cuando una tarea cambie de prioridad' },
  { value: 'task.unassigned',       label: 'Cuando una tarea quede sin responsable' },
]

const ACTION_OPTIONS: { value: string; label: string; fields: string[] }[] = [
  { value: 'set_priority',  label: 'Cambiar prioridad',  fields: ['priority'] },
  { value: 'set_status',    label: 'Cambiar estado',     fields: ['status'] },
  { value: 'move_to_group', label: 'Mover a grupo',      fields: ['groupId'] },
  { value: 'alert_users',   label: 'Alertar a usuarios', fields: ['userIds'] },
]

const PRIORITY_OPTIONS = ['Baja', 'Media', 'Alta', 'Critica', 'AlwaysOn']

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(TRIGGER_OPTIONS.map(t => [t.value, t.label]))
const ACTION_LABEL: Record<string, string> = Object.fromEntries(ACTION_OPTIONS.map(a => [a.value, a.label]))

function configSummary(
  actionType: string,
  config: Record<string, unknown>,
  groups: { id: string; name: string }[],
  userNames: Map<string, string>,
): string {
  if (actionType === 'set_priority') return `→ Prioridad: ${config.priority ?? '?'}`
  if (actionType === 'set_status')   return `→ Estado: ${config.status ?? '?'}`
  if (actionType === 'move_to_group') {
    const g = groups.find(g => g.id === config.groupId)
    return `→ Grupo: ${g?.name ?? config.groupId ?? '?'}`
  }
  if (actionType === 'alert_users') {
    const ids = (config.userIds as string[] | undefined) ?? []
    if (ids.length === 0) return '→ Sin usuarios seleccionados'
    const names = ids.map(id => userNames.get(id) ?? id).join(', ')
    return `→ Alertar a: ${names}`
  }
  return ''
}

export function AutomationPanel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { boardId } = useParams<{ boardId: string }>()
  const isOpen = searchParams.get('panel') === 'automations'

  const boards = useBoardStore(state => state.boards)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const board = boards.find(b => b.id === boardId)
  const groups = board?.groups ?? []

  const userNames = new Map(apiUsers.map(u => [u.id, u.name]))

  const [automations, setAutomations] = useState<ApiAutomation[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState(TRIGGER_OPTIONS[0].value)
  const [newAction, setNewAction] = useState(ACTION_OPTIONS[0].value)
  const [newConfig, setNewConfig] = useState<Record<string, string>>({})
  const [newAlertUserIds, setNewAlertUserIds] = useState<string[]>([])

  function close() {
    const params = new URLSearchParams(searchParams)
    params.delete('panel')
    navigate('?' + params.toString())
  }

  function resetModal() {
    setNewName('')
    setNewTrigger(TRIGGER_OPTIONS[0].value)
    setNewAction(ACTION_OPTIONS[0].value)
    setNewConfig({})
    setNewAlertUserIds([])
  }

  useEffect(() => {
    if (!isOpen || !boardId) return
    setLoading(true)
    api.automations.listByBoard(boardId)
      .then(({ automations }) => setAutomations(automations))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isOpen, boardId])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showModal) close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, showModal])

  async function toggleEnabled(auto: ApiAutomation) {
    const updated = await api.automations.update(auto.id, { enabled: !auto.enabled })
    setAutomations(prev => prev.map(a => a.id === auto.id ? updated.automation : a))
  }

  async function deleteAutomation(id: string) {
    await api.automations.delete(id)
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  function toggleAlertUser(userId: string) {
    setNewAlertUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  async function createAutomation() {
    if (!newName.trim() || !boardId) return
    setSaving(true)
    try {
      const config: Record<string, unknown> = newAction === 'alert_users'
        ? { userIds: newAlertUserIds }
        : newConfig
      const { automation } = await api.automations.create(boardId, {
        name: newName.trim(),
        triggerEvent: newTrigger,
        actionType: newAction,
        config: config as Record<string, string>,
      })
      setAutomations(prev => [...prev, automation])
      resetModal()
      setShowModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const selectedActionDef = ACTION_OPTIONS.find(a => a.value === newAction)

  if (!isOpen) return null

  const activeCount = automations.filter(a => a.enabled).length

  return (
    <>
      <div className="fixed inset-0 bg-black/10 z-40" onClick={close} />
      <aside className="fixed right-0 top-0 h-full w-[480px] bg-gray-50 shadow-2xl z-50 flex flex-col border-l border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Automatizaciones</h2>
              <p className="text-xs text-gray-500">Reglas activas del tablero</p>
            </div>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
          ) : (
            <>
              {automations.length > 0 && (
                <div className="flex items-center justify-between bg-orange-50 px-3 py-2 rounded-lg text-xs text-orange-700 font-medium">
                  <span>{activeCount} activas</span>
                  <span className="text-orange-500">{automations.reduce((s, a) => s + a.triggerCount, 0)} ejecuciones totales</span>
                </div>
              )}

              {automations.map(auto => (
                <div key={auto.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-200 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{auto.name}</h4>
                      <span className="text-xs text-gray-400">{auto.triggerCount} ejecuciones</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => deleteAutomation(auto.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleEnabled(auto)}>
                        {auto.enabled
                          ? <ToggleRight className="w-7 h-7 text-orange-500" />
                          : <ToggleLeft className="w-7 h-7 text-gray-300" />
                        }
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                      <span className="text-xs font-semibold text-blue-600 w-16 shrink-0 mt-0.5">Cuando</span>
                      <span className="text-xs text-blue-800">{TRIGGER_LABEL[auto.triggerEvent] ?? auto.triggerEvent}</span>
                    </div>
                    <div className="flex items-center justify-center"><ArrowRight className="w-4 h-4 text-gray-400" /></div>
                    <div className="flex items-start gap-2 bg-green-50 px-3 py-2 rounded-lg">
                      <span className="text-xs font-semibold text-green-600 w-16 shrink-0 mt-0.5">Entonces</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-green-800">
                          {ACTION_LABEL[auto.actionType] ?? auto.actionType}{' '}
                          {configSummary(auto.actionType, auto.config, groups, userNames)}
                        </span>
                        {/* Show avatars for alert_users */}
                        {auto.actionType === 'alert_users' && (auto.config.userIds as string[] | undefined)?.length ? (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {(auto.config.userIds as string[]).map(uid => (
                              <AssigneeAvatar key={uid} userId={uid} size="sm" />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {automations.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin automatizaciones</p>
                  <p className="text-xs mt-1">Creá una para empezar</p>
                </div>
              )}

              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva automatización
              </button>
            </>
          )}
        </div>
      </aside>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetModal() }} title="Nueva automatización" size="md">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Ej: Urgencia por completado"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Cuando...</label>
            <select
              value={newTrigger}
              onChange={e => setNewTrigger(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Entonces...</label>
            <select
              value={newAction}
              onChange={e => { setNewAction(e.target.value); setNewConfig({}); setNewAlertUserIds([]) }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {selectedActionDef?.fields.includes('priority') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prioridad destino</label>
              <select
                value={newConfig.priority ?? ''}
                onChange={e => setNewConfig(c => ({ ...c, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Seleccioná...</option>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {selectedActionDef?.fields.includes('status') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Estado destino</label>
              <input
                value={newConfig.status ?? ''}
                onChange={e => setNewConfig(c => ({ ...c, status: e.target.value }))}
                placeholder="Ej: Completado, Bloqueado..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          {selectedActionDef?.fields.includes('groupId') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Grupo destino</label>
              <select
                value={newConfig.groupId ?? ''}
                onChange={e => setNewConfig(c => ({ ...c, groupId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Seleccioná...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {selectedActionDef?.fields.includes('userIds') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-orange-400" />
                Usuarios a alertar
              </label>
              {apiUsers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Abrí un tablero primero para ver los miembros.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {apiUsers.map(u => {
                    const selected = newAlertUserIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAlertUser(u.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                          selected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <AssigneeAvatar userId={u.id} size="sm" />
                        <span className="flex-1 text-sm text-gray-700">{u.name}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
              {newAlertUserIds.length > 0 && (
                <p className="text-xs text-orange-600 mt-1">{newAlertUserIds.length} usuario{newAlertUserIds.length !== 1 ? 's' : ''} seleccionado{newAlertUserIds.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setShowModal(false); resetModal() }}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={createAutomation}
              disabled={!newName.trim() || saving || (newAction === 'alert_users' && newAlertUserIds.length === 0)}
              className="flex-1 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
