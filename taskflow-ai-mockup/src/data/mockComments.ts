import type { MockComment } from '@/types'

export const mockComments: MockComment[] = []

export function getCommentsByTaskId(taskId: string): MockComment[] {
  return mockComments.filter(c => c.taskId === taskId)
}
