import { useState, useEffect } from 'react'
import { Mail, AlertCircle } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'
import type { ApiWorkspaceMember } from '@/lib/api'

export function EmailAlertsPage() {
  const { workspace, workspaces } = useBoardStore()
  const currentWorkspace = workspace ?? workspaces[0] ?? null

  const [members, setMembers] = useState<ApiWorkspaceMember[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    api.workspaces.get(currentWorkspace.id)
      .then(({ workspace }) => setMembers(workspace.members))
      .catch(() => toast('Error cargando miembros.', 'error'))
      .finally(() => setLoading(false))
  }, [currentWorkspace?.id])

  async function handleToggle(member: ApiWorkspaceMember) {
    if (!currentWorkspace) return
    const memberId = member.userId
    setToggling(memberId)
    try {
      const { member: updated } = await api.workspaces.updateMemberEmailNotifications(
        currentWorkspace.id,
        memberId,
        !member.emailNotifications,
      )
      setMembers(prev =>
        prev.map(m =>
          m.userId === memberId
            ? { ...m, emailNotifications: updated.emailNotifications }
            : m
        )
      )
      toast(
        updated.emailNotifications
          ? 'Alertas por correo activadas.'
          : 'Alertas por correo desactivadas.',
        'success'
      )
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setToggling(null)
    }
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-gray-400">Cargá un tablero primero para acceder al workspace.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Alertas por correo</h1>
          <p className="text-sm text-gray-500">
            Controlá qué miembros reciben notificaciones por email cuando se disparan automatizaciones.
          </p>
        </div>

        {/* Members table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {members.length} miembro{members.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">Cargando miembros...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No hay miembros en este workspace.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map(member => (
                <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: member.user.color ?? '#6366f1' }}
                  >
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.user.initials
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{member.user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    member.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : member.role === 'MEMBER'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {member.role}
                  </span>

                  {/* Toggle */}
                  <button
                    disabled={toggling === member.userId}
                    onClick={() => handleToggle(member)}
                    title={member.emailNotifications ? 'Desactivar alertas por correo' : 'Activar alertas por correo'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      member.emailNotifications ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={member.emailNotifications}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${
                        member.emailNotifications ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
          <span>
            Los miembros con alertas desactivadas seguirán recibiendo notificaciones dentro de la app, pero no recibirán emails cuando se disparen automatizaciones.
          </span>
        </div>

        {/* Mail icon decoration */}
        <div className="mt-6 flex items-center gap-2 text-gray-300">
          <Mail className="w-4 h-4" />
          <span className="text-xs">Las alertas se envían desde las automatizaciones configuradas en cada tablero.</span>
        </div>
      </div>
    </div>
  )
}
