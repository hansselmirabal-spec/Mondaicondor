import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({
  title = 'Sin tareas',
  description = 'Agregá un elemento para comenzar.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <Inbox className="w-8 h-8 mb-2" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs mt-0.5">{description}</p>
    </div>
  )
}
