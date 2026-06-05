import type { MockActivity } from '@/types'

export const mockActivity: MockActivity[] = []

export function getActivityByTaskId(taskId: string): MockActivity[] {
  return mockActivity.filter(a => a.taskId === taskId)
}
