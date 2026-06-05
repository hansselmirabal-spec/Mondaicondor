import type { MockTask } from '@/types'

export const mockTasks: MockTask[] = []

export function getTaskById(id: string): MockTask | undefined {
  return mockTasks.find(t => t.id === id)
}

export function getTasksByGroupId(groupId: string): MockTask[] {
  return mockTasks.filter(t => t.groupId === groupId)
}

export function getTasksByBoardId(boardId: string): MockTask[] {
  return mockTasks.filter(t => t.boardId === boardId)
}
