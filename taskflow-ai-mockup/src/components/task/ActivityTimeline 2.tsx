import { getActivityByTaskId } from '@/data/mockActivity'
import { getUserById } from '@/data/mockUsers'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'

interface ActivityTimelineProps {
  taskId: string
}

export function ActivityTimeline({ taskId }: ActivityTimelineProps) {
  const activities = getActivityByTaskId(taskId)

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString('es-PY', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  if (activities.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">Actividad</h4>
      <div className="space-y-2">
        {activities.map(act => {
          const user = getUserById(act.userId)
          return (
            <div key={act.id} className="flex gap-2 items-start">
              {user && <AssigneeAvatar userId={user.id} size="sm" />}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{user?.name}</span>
                  {' '}{act.action}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">{formatTs(act.timestamp)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
