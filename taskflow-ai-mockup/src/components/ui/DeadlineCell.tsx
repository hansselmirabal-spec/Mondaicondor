import { formatDate } from '@/lib/utils'

interface DeadlineCellProps {
  deadline: string | null
}

export function DeadlineCell({ deadline }: DeadlineCellProps) {
  if (!deadline) return <span className="text-gray-300">—</span>

  const date = new Date(deadline + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = date < today

  return (
    <span className={`text-xs font-medium ${isPast ? 'text-red-500' : 'text-gray-600'}`}>
      {formatDate(deadline)}
    </span>
  )
}
