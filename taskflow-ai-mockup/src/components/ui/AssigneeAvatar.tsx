import { useBoardStore } from '@/store/boardStore'

interface AssigneeAvatarProps {
  userId: string
  size?: 'sm' | 'md'
}

interface AssigneeAvatarGroupProps {
  userIds: string[]
  max?: number
}

export function AssigneeAvatar({ userId, size = 'sm' }: AssigneeAvatarProps) {
  const apiUsers = useBoardStore(state => state.apiUsers)
  const user = apiUsers.find(u => u.id === userId)
  const dim = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  if (!user) return null
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        className={`rounded-full object-cover shrink-0 ${dim}`}
      />
    )
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${dim}`}
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {user.initials}
    </span>
  )
}

export function AssigneeAvatarGroup({ userIds, max = 3 }: AssigneeAvatarGroupProps) {
  const visible = userIds.slice(0, max)
  const overflow = userIds.length - max
  return (
    <div className="flex items-center">
      {visible.map((id, i) => (
        <span key={id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visible.length - i }}>
          <AssigneeAvatar userId={id} size="sm" />
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-300 text-gray-700 text-xs font-semibold -ml-1.5">
          +{overflow}
        </span>
      )}
    </div>
  )
}
