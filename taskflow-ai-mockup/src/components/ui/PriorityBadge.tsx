import { getPriorityStyle } from '@/lib/utils'
import type { PriorityType } from '@/types'

interface PriorityBadgeProps {
  priority: PriorityType
  className?: string
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const { bg, text } = getPriorityStyle(priority)
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium w-full truncate ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {priority}
    </span>
  )
}
