import { useBoardStore } from '@/store/boardStore'

interface ActivityTimelineProps {
  taskId: string
}

export function ActivityTimeline({ taskId }: ActivityTimelineProps) {
  const apiTasks = useBoardStore(state => state.apiTasks)
  const newTasks = useBoardStore(state => state.newTasks)
  const task = apiTasks.find(t => t.id === taskId) ?? newTasks.find(t => t.id === taskId)

  if (!task) return null

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString('es-PY', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  const wasUpdated =
    new Date(task.updatedAt).getTime() !== new Date(task.createdAt).getTime()

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">Actividad</h4>
      <div className="space-y-2">
        <div className="flex gap-2 items-start">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 shrink-0">•</div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-600">Tarea creada</span>
            <p className="text-xs text-gray-400 mt-0.5">{formatTs(task.createdAt)}</p>
          </div>
        </div>
        {wasUpdated && (
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 shrink-0">•</div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-600">Última actualización</span>
              <p className="text-xs text-gray-400 mt-0.5">{formatTs(task.updatedAt)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
