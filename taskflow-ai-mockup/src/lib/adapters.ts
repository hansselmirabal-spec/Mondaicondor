import type { MockBoard, MockGroup, MockTask, MockUser, PriorityType } from '@/types'
import type { ApiBoard, ApiTask, ApiUser } from './api'

const PRIORITY_MAP: Record<string, PriorityType> = {
  Baja: 'Baja',
  Media: 'Media',
  Alta: 'Alta',
  Critica: 'Crítica',
  AlwaysOn: 'Siempre activo',
}

export function toMockUser(u: ApiUser): MockUser {
  return {
    id: u.id,
    name: u.name,
    initials: u.initials,
    color: u.color,
    email: u.email,
  }
}

export function toMockTask(t: ApiTask): MockTask {
  const priority = PRIORITY_MAP[t.priority]
  if (!priority) console.warn(`[adapters] Unknown task priority: "${t.priority}"`)

  return {
    id: t.id,
    groupId: t.groupId,
    boardId: t.group.boardId,
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: priority ?? 'Media',
    deadline: t.deadline ? t.deadline.slice(0, 10) : null,
    fileUrl: t.fileUrl,
    text: null,
    order: t.order ?? 0,
    assigneeIds: t.assignees.map((a) => a.user.id),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    uenIds: (t.uens ?? []).map(u => u.id),
    customFields: t.customFields ?? {},
    isPrivate: t.isPrivate ?? false,
    createdBy: t.createdBy ?? null,
    recurrenceRule: t.recurrenceRule ?? null,
  }
}

export function toMockBoard(b: ApiBoard): MockBoard {
  const groups: MockGroup[] = (b.groups ?? []).map((g) => ({
    id: g.id,
    boardId: b.id,
    name: g.name,
    color: g.color,
  }))

  return {
    id: b.id,
    workspaceId: b.workspaceId,
    name: b.name,
    description: b.description ?? '',
    isPrivate: b.isPrivate ?? false,
    boardMembers: b.boardMembers,
    groups,
  }
}

export function extractUsers(board: ApiBoard): MockUser[] {
  const seen = new Set<string>()
  const users: MockUser[] = []
  for (const group of (board.groups ?? [])) {
    for (const task of group.tasks) {
      for (const { user } of task.assignees) {
        if (!seen.has(user.id)) {
          seen.add(user.id)
          users.push(toMockUser(user))
        }
      }
    }
  }
  return users
}

export function extractTasks(board: ApiBoard): MockTask[] {
  return (board.groups ?? []).flatMap((g) =>
    (g.tasks ?? []).map((t) =>
      toMockTask({ ...t, group: { id: g.id, name: g.name, boardId: board.id } })
    )
  )
}
