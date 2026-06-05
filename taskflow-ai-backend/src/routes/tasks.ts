import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const taskRoutes = new Hono<AppEnv>()

taskRoutes.use('*', authMiddleware)

const priorityValues = ['Baja', 'Media', 'Alta', 'Critica', 'AlwaysOn'] as const

const createTaskSchema = z.object({
  groupId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  deadline: z.string().datetime().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  deadline: z.string().datetime().nullable().optional(),
  groupId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
})

const taskInclude = {
  assignees: {
    include: {
      user: { select: { id: true, name: true, initials: true, color: true, avatarUrl: true } },
    },
  },
  group: { select: { id: true, name: true, boardId: true } },
}

taskRoutes.get('/board/:boardId', async (c) => {
  const { userId } = c.get('user')
  const { boardId } = c.req.param()
  const rawQuery = c.req.query()
  const status = rawQuery.status || undefined
  const priority = priorityValues.includes(rawQuery.priority as typeof priorityValues[number])
    ? (rawQuery.priority as typeof priorityValues[number])
    : undefined
  const { assigneeId, groupId } = rawQuery

  const board = await prisma.board.findUnique({ where: { id: boardId } })
  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
  })
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  const tasks = await prisma.task.findMany({
    where: {
      group: { boardId },
      ...(status && { status }),
      ...(priority && { priority: priority as typeof priorityValues[number] }),
      ...(groupId && { groupId }),
      ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
    },
    include: taskInclude,
    orderBy: { createdAt: 'asc' },
  })

  return c.json({ tasks })
})

taskRoutes.post('/', zValidator('json', createTaskSchema), async (c) => {
  const { userId } = c.get('user')
  const { groupId, title, description, status, priority, deadline, assigneeIds } = c.req.valid('json')

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { board: true },
  })
  if (!group) return c.json({ error: 'Grupo no encontrado' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: group.board.workspaceId, userId } },
  })
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos para crear tareas' }, 403)
  }

  const task = await prisma.task.create({
    data: {
      groupId,
      title,
      description,
      status: status ?? 'Nuevo',
      priority: priority ?? 'Media',
      deadline: deadline ? new Date(deadline) : null,
      assignees: assigneeIds?.length
        ? { create: assigneeIds.map((uid) => ({ userId: uid })) }
        : undefined,
    },
    include: taskInclude,
  })

  await prisma.activity.create({
    data: { taskId: task.id, userId, action: `Creó la tarea "${title}"` },
  })

  return c.json({ task }, 201)
})

taskRoutes.get('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      ...taskInclude,
      comments: {
        include: { author: { select: { id: true, name: true, initials: true, color: true } } },
        orderBy: { createdAt: 'asc' },
      },
      activities: {
        include: { user: { select: { id: true, name: true, initials: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const board = await prisma.board.findUnique({ where: { id: task.group.boardId } })
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: board!.workspaceId, userId } },
  })
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  return c.json({ task })
})

taskRoutes.put('/:id', zValidator('json', updateTaskSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { assigneeIds, deadline, ...rest } = c.req.valid('json')

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { group: { include: { board: true } } },
  })
  if (!existing) return c.json({ error: 'Tarea no encontrada' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: existing.group.board.workspaceId, userId } },
  })
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos' }, 403)
  }

  const changes: string[] = []
  if (rest.status && rest.status !== existing.status) changes.push(`Estado: ${existing.status} → ${rest.status}`)
  if (rest.priority && rest.priority !== existing.priority) changes.push(`Prioridad: ${existing.priority} → ${rest.priority}`)
  if (rest.title && rest.title !== existing.title) changes.push(`Título actualizado`)

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(assigneeIds && {
        assignees: {
          deleteMany: {},
          create: assigneeIds.map((uid) => ({ userId: uid })),
        },
      }),
    },
    include: taskInclude,
  })

  if (changes.length > 0) {
    await prisma.activity.create({
      data: { taskId: id, userId, action: changes.join(' | ') },
    })
  }

  // Evaluate automations
  await evaluateAutomations(task, existing, userId)

  return c.json({ task })
})

async function evaluateAutomations(
  task: Awaited<ReturnType<typeof prisma.task.update>>,
  before: { status: string; priority: string; groupId: string },
  triggeredBy: string,
) {
  const boardId = (task as any).group.boardId
  const automations = await prisma.automation.findMany({ where: { boardId, enabled: true } })

  for (const auto of automations) {
    const fired = checkTrigger(auto.triggerEvent, task as any, before)
    if (!fired) continue

    const cfg = auto.config as Record<string, string>
    let applied = false

    if (auto.actionType === 'set_priority' && cfg.priority) {
      await prisma.task.update({ where: { id: task.id }, data: { priority: cfg.priority as any } })
      applied = true
    } else if (auto.actionType === 'set_status' && cfg.status) {
      await prisma.task.update({ where: { id: task.id }, data: { status: cfg.status } })
      applied = true
    } else if (auto.actionType === 'move_to_group' && cfg.groupId) {
      const targetGroup = await prisma.group.findUnique({ where: { id: cfg.groupId } })
      if (targetGroup) {
        await prisma.task.update({ where: { id: task.id }, data: { groupId: cfg.groupId } })
        applied = true
      }
    } else if (auto.actionType === 'alert_users') {
      const alertCfg = auto.config as { userIds?: string[] }
      const userIds = alertCfg.userIds ?? []
      if (userIds.length > 0) {
        const newStatus = (task as any).status as string
        await prisma.notification.createMany({
          data: userIds.map((uid: string) => ({
            userId: uid,
            title: auto.name,
            body: `"${(task as any).title}" → ${newStatus}`,
            taskId: task.id,
            boardId,
          })),
        })
        applied = true
      }
    }

    if (applied) {
      await prisma.automation.update({ where: { id: auto.id }, data: { triggerCount: { increment: 1 } } })
      await prisma.activity.create({
        data: {
          taskId: task.id,
          userId: triggeredBy,
          action: `Automatización ejecutada: "${auto.name}"`,
        },
      })
    }
  }
}

function checkTrigger(
  event: string,
  task: { status: string; priority: string; groupId: string; assignees: { userId?: string }[] },
  before: { status: string; priority: string; groupId: string },
): boolean {
  switch (event) {
    case 'task.completed':
      return task.status === 'Completado' && before.status !== 'Completado'
    case 'task.status_changed':
      return task.status !== before.status
    case 'task.priority_changed':
      return task.priority !== before.priority
    case 'task.unassigned':
      return (task as any).assignees?.length === 0
    case 'task.blocked':
      return task.status === 'Bloqueado' && before.status !== 'Bloqueado'
    default:
      return false
  }
}

taskRoutes.delete('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const task = await prisma.task.findUnique({
    where: { id },
    include: { group: { include: { board: true } } },
  })
  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.group.board.workspaceId, userId } },
  })
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos' }, 403)
  }

  await prisma.task.delete({ where: { id } })
  return c.json({ message: 'Tarea eliminada' })
})

taskRoutes.post('/:id/comments', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()
  const content = z.string().min(1).parse(body?.content)

  const task = await prisma.task.findUnique({
    where: { id },
    include: { group: { include: { board: true } } },
  })
  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.group.board.workspaceId, userId } },
  })
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { taskId: id, authorId: userId, content },
      include: { author: { select: { id: true, name: true, initials: true, color: true } } },
    }),
    prisma.activity.create({
      data: { taskId: id, userId, action: 'Agregó un comentario' },
    }),
  ])

  return c.json({ comment }, 201)
})
