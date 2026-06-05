import { useBoardStore } from '@/store/boardStore'
import { getStatusInfo } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const { label, bg, text } = getStatusInfo(status, workspaceStatuses)
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium w-full truncate ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  )
}
