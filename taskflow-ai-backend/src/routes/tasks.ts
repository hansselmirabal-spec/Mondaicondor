import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { isWorkspaceAdmin } from '../lib/authz.js'
import type { AppEnv } from '../lib/types.js'
import { sendAlertEmail, sendTaskNotificationEmail } from '../lib/email.js'

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
  uenIds: z.array(z.string()).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  deadline: z.string().datetime().nullable().optional(),
  groupId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  uenIds: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
})

const taskInclude = {
  assignees: {
    include: {
      user: { select: { id: true, name: true, initials: true, color: true, avatarUrl: true } },
    },
  },
  group: { select: { id: true, name: true, boardId: true } },
  uens: { select: { id: true, name: true, color: true } },
}

// Extended include for /mine — adds board name so the frontend can group by board
const taskMineInclude = {
  assignees: taskInclude.assignees,
  uens: taskInclude.uens,
  group: {
    select: {
      id: true, name: true, boardId: true,
      board: { select: { id: true, name: true, workspaceId: true } },
    },
  },
}

async function notifyUsers(opts: {
  userIds: string[]
  actorId: string
  title: string
  body: string
  taskId: string
  boardId: string
  workspaceId: string
}) {
  const { userIds, actorId, title, body, taskId, boardId, workspaceId } = opts
  const targets = userIds.filter(id => id !== actorId)
  if (targets.length === 0) return

  await prisma.notification.createMany({
    data: targets.map(uid => ({ userId: uid, title, body, taskId, boardId })),
  })

  const taskUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/boards/${boardId}?task=${taskId}`
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: targets }, emailNotifications: true },
    include: { user: { select: { email: true, name: true } } },
  })
  await Promise.allSettled(
    members.map(m => sendTaskNotificationEmail(m.user.email, m.user.name, title, body, taskUrl)),
  )
}

// ── My tasks — all tasks where the current user is an assignee ───────────────
taskRoutes.get('/mine', async (c) => {
  const { userId } = c.get('user')

  const assignments = await prisma.taskAssignee.findMany({
    where: { userId },
    include: { task: { include: taskMineInclude } },
  })

  const tasks = assignments
    .map(a => a.task)
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })

  return c.json({ tasks })
})

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
    orderBy: { order: 'asc' },
  })

  return c.json({ tasks })
})

taskRoutes.post('/', zValidator('json', createTaskSchema), async (c) => {
  const { userId } = c.get('user')
  const { groupId, title, description, status, priority, deadline, assigneeIds, uenIds } = c.req.valid('json')

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

  if (assigneeIds && assigneeIds.length > 0) {
    const validMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: group.board.workspaceId, userId: { in: assigneeIds } },
      select: { userId: true },
    })
    const validIds = new Set(validMembers.map(m => m.userId))
    const invalid = assigneeIds.filter(id => !validIds.has(id))
    if (invalid.length > 0) {
      return c.json({ error: 'One or more assignees are not members of this workspace' }, 400)
    }
  }

  // New tasks go to the TOP: one below the current minimum order in the group.
  const agg = await prisma.task.aggregate({ where: { groupId }, _min: { order: true } })
  const order = (agg._min.order ?? 0) - 1

  const task = await prisma.task.create({
    data: {
      groupId,
      title,
      description,
      status: status ?? 'Nuevo',
      priority: priority ?? 'Media',
      deadline: deadline ? new Date(deadline) : null,
      createdBy: userId,
      order,
      assignees: assigneeIds?.length
        ? { create: assigneeIds.map((uid) => ({ userId: uid })) }
        : undefined,
      uens: uenIds?.length
        ? { connect: uenIds.map((id) => ({ id })) }
        : undefined,
      activities: {
        create: { userId, action: `Creó la tarea "${title}"` },
      },
    },
    include: taskInclude,
  })

  if (assigneeIds?.length) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    await notifyUsers({
      userIds: assigneeIds,
      actorId: userId,
      title: 'Te asignaron a una tarea',
      body: `${actor?.name ?? 'Alguien'} te asignó a "${title}"`,
      taskId: task.id,
      boardId: group.board.id,
      workspaceId: group.board.workspaceId,
    })
  }

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
  if (!board) return c.json({ error: 'Tablero no encontrado' }, 404)

  const [membership, assignee] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
    }),
    prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId: task.id, userId } } }),
  ])
  if (!membership && !assignee) return c.json({ error: 'Sin acceso' }, 403)

  return c.json({ task })
})

// Strict YYYY-MM-DD (ISO date-only) check: the regex only confirms shape, so
// this also rejects calendar overflow (e.g. "2024-02-30") that a bare
// `new Date(value)` would silently roll forward instead of flagging.
function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function getActiveOptionIds(config: unknown): Set<string> {
  const options = config && typeof config === 'object' && !Array.isArray(config)
    ? (config as { options?: { id: string; archivedAt: string | null }[] }).options
    : undefined
  return new Set(Array.isArray(options) ? options.filter((o) => !o.archivedAt).map((o) => o.id) : [])
}

// Validates a customFields patch against the board's active definitions.
// A `null` value always passes through untouched — it means "delete this
// key" and is handled by the merge rule in the PUT handler, not here.
async function validateCustomFieldPatch(
  boardId: string,
  patch: Record<string, unknown>,
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { boardId, archivedAt: null },
  })
  const byId = new Map(definitions.map((d) => [d.id, d]))

  const data: Record<string, unknown> = {}
  for (const [fieldId, value] of Object.entries(patch)) {
    const def = byId.get(fieldId)
    if (!def) return { error: 'Campo personalizado no encontrado o archivado' }

    if (value === null) {
      data[fieldId] = null
      continue
    }

    switch (def.type) {
      case 'TEXT': {
        if (typeof value !== 'string') return { error: `El campo "${def.label}" debe ser texto` }
        data[fieldId] = value
        break
      }
      case 'NUMBER': {
        if (
          typeof value !== 'number'
          || Number.isNaN(value)
          || !Number.isFinite(value)
          || Math.abs(value) >= 1e12
        ) {
          return { error: `El campo "${def.label}" debe ser un número válido` }
        }
        data[fieldId] = value
        break
      }
      case 'DATE': {
        if (typeof value !== 'string' || !isValidCalendarDate(value)) {
          return { error: `El campo "${def.label}" debe tener formato YYYY-MM-DD` }
        }
        data[fieldId] = value
        break
      }
      case 'CHECKBOX': {
        if (typeof value !== 'boolean') return { error: `El campo "${def.label}" debe ser verdadero o falso` }
        data[fieldId] = value
        break
      }
      case 'SELECT': {
        if (typeof value !== 'string' || !getActiveOptionIds(def.config).has(value)) {
          return { error: `El campo "${def.label}" tiene una opción inválida o archivada` }
        }
        data[fieldId] = value
        break
      }
      default:
        return { error: 'Tipo de campo desconocido' }
    }
  }

  return { data }
}

taskRoutes.put('/:id', zValidator('json', updateTaskSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { assigneeIds, deadline, uenIds, customFields, ...rest } = c.req.valid('json')

  const existing = await prisma.task.findUnique({
    where: { id },
    include: {
      group: { include: { board: true } },
      assignees: { select: { userId: true } },
    },
  })
  if (!existing) return c.json({ error: 'Tarea no encontrada' }, 404)

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: existing.group.board.workspaceId, userId } },
  })
  const isAssignee = existing.assignees.some((a: any) => a.userId === userId)

  if (!membership && !isAssignee) return c.json({ error: 'Sin permisos' }, 403)
  if (membership?.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  // Assignees who are not workspace members can only change status/priority/description/deadline
  // or custom fields — `customFields` deliberately doesn't participate in this condition.
  if (!membership && isAssignee && (assigneeIds || rest.groupId || uenIds !== undefined)) {
    return c.json({ error: 'Solo podés actualizar el estado, prioridad, descripción, fecha límite o campos personalizados de esta tarea' }, 403)
  }

  if (assigneeIds && assigneeIds.length > 0) {
    const validMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: existing.group.board.workspaceId, userId: { in: assigneeIds } },
      select: { userId: true },
    })
    const validIds = new Set(validMembers.map(m => m.userId))
    const invalid = assigneeIds.filter(id => !validIds.has(id))
    if (invalid.length > 0) {
      return c.json({ error: 'One or more assignees are not members of this workspace' }, 400)
    }
  }

  let targetGroup: { boardId: string; board: { workspaceId: string } } | null = null
  if (rest.groupId) {
    targetGroup = await prisma.group.findUnique({
      where: { id: rest.groupId },
      include: { board: { select: { workspaceId: true } } },
    })
    if (!targetGroup) return c.json({ error: 'Group not found' }, 404)
    if (targetGroup.board.workspaceId !== existing.group.board.workspaceId) {
      return c.json({ error: 'Cannot move task to a group in a different workspace' }, 403)
    }
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: targetGroup.board.workspaceId, userId } },
    })
    if (!targetMembership) return c.json({ error: 'Sin acceso al workspace destino' }, 403)
  }

  // Custom fields: start from the existing stored object (guarded — Prisma's
  // JsonValue can be null/string/array, never a blind `as object` cast),
  // apply the patch's null-deletes-key / value-overwrites-key rule, then —
  // if this PUT also moves the task cross-board via groupId — drop any key
  // that isn't an active definition on the destination board.
  const customFieldsBase: Record<string, unknown> = typeof existing.customFields === 'object'
    && existing.customFields !== null
    && !Array.isArray(existing.customFields)
    ? existing.customFields
    : {}
  const mergedCustomFields: Record<string, unknown> = { ...customFieldsBase }
  let customFieldsChanged = false

  if (customFields !== undefined) {
    const validated = await validateCustomFieldPatch(existing.group.board.id, customFields)
    if ('error' in validated) return c.json({ error: validated.error }, 400)
    for (const [key, value] of Object.entries(validated.data)) {
      if (value === null) delete mergedCustomFields[key]
      else mergedCustomFields[key] = value
    }
    customFieldsChanged = true
  }

  if (targetGroup && targetGroup.boardId !== existing.group.boardId) {
    const targetDefinitions = await prisma.customFieldDefinition.findMany({
      where: { boardId: targetGroup.boardId, archivedAt: null },
      select: { id: true },
    })
    const activeFieldIds = new Set(targetDefinitions.map((d) => d.id))
    for (const key of Object.keys(mergedCustomFields)) {
      if (!activeFieldIds.has(key)) delete mergedCustomFields[key]
    }
    customFieldsChanged = true
  }

  const changes: string[] = []
  if (rest.status && rest.status !== existing.status) changes.push(`Estado: ${existing.status} → ${rest.status}`)
  if (rest.priority && rest.priority !== existing.priority) changes.push(`Prioridad: ${existing.priority} → ${rest.priority}`)
  if (rest.title && rest.title !== existing.title) changes.push(`Título actualizado`)

  const taskUpdateOp = prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(uenIds !== undefined && { uens: { set: uenIds.map((id) => ({ id })) } }),
      ...(assigneeIds && {
        assignees: {
          deleteMany: {},
          create: assigneeIds.map((uid) => ({ userId: uid })),
        },
      }),
      ...(customFieldsChanged && { customFields: mergedCustomFields as Prisma.InputJsonValue }),
    },
    include: taskInclude,
  })

  const [task] = changes.length > 0
    ? await prisma.$transaction([
        taskUpdateOp,
        prisma.activity.create({ data: { taskId: id, userId, action: changes.join(' | ') } }),
      ])
    : [await taskUpdateOp]

  const boardId = existing.group.board.id
  const workspaceId = existing.group.board.workspaceId
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const actorName = actor?.name ?? 'Alguien'

  // Notify newly assigned users
  if (assigneeIds) {
    const previousIds = existing.assignees?.map((a: any) => a.userId) ?? []
    const newlyAssigned = assigneeIds.filter((uid: string) => !previousIds.includes(uid))
    if (newlyAssigned.length > 0) {
      await notifyUsers({
        userIds: newlyAssigned,
        actorId: userId,
        title: 'Te asignaron a una tarea',
        body: `${actorName} te asignó a "${existing.title}"`,
        taskId: id,
        boardId,
        workspaceId,
      })
    }
  }

  // Notify current assignees when status or priority changes
  if (rest.status && rest.status !== existing.status) {
    const currentAssignees = (task as any).assignees?.map((a: any) => a.userId) ?? []
    await notifyUsers({
      userIds: currentAssignees,
      actorId: userId,
      title: 'Estado de tarea actualizado',
      body: `${actorName} cambió "${existing.title}": ${existing.status} → ${rest.status}`,
      taskId: id,
      boardId,
      workspaceId,
    })
  }

  if (rest.priority && rest.priority !== existing.priority) {
    const currentAssignees = (task as any).assignees?.map((a: any) => a.userId) ?? []
    await notifyUsers({
      userIds: currentAssignees,
      actorId: userId,
      title: 'Prioridad de tarea actualizada',
      body: `${actorName} cambió la prioridad de "${existing.title}": ${existing.priority} → ${rest.priority}`,
      taskId: id,
      boardId,
      workspaceId,
    })
  }

  // Evaluate automations
  await evaluateAutomations(task, existing, userId)

  return c.json({ task })
})

const STATUS_LABELS: Record<string, string> = {
  Nuevo: 'Nuevo',
  Asignado: 'Asignado',
  EnProgreso: 'En progreso',
  EnRevision: 'En revisión',
  Bloqueado: 'Bloqueado',
  Completado: 'Completado',
  AlwaysOn: 'Always On',
}

function formatStatus(slug: string): string {
  return STATUS_LABELS[slug] ?? slug
}

async function evaluateAutomations(
  task: Awaited<ReturnType<typeof prisma.task.update>>,
  before: { status: string; priority: string; groupId: string },
  triggeredBy: string,
  depth: number = 0,
  firedIds: Set<string> = new Set(),
) {
  if (depth >= 3) {
    console.warn(`[automations] depth limit reached for task ${task.id}`)
    return
  }

  const boardId = (task as any).group.boardId
  const automations = await prisma.automation.findMany({ where: { boardId, enabled: true } })

  for (const auto of automations) {
    const fired = checkTrigger(auto.triggerEvent, task as any, before)
    if (!fired) continue

    if (firedIds.has(auto.id)) continue
    firedIds.add(auto.id)

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
        const taskTitle = (task as any).title as string
        const fromStatus = formatStatus(before.status)
        const toStatus = formatStatus((task as any).status)

        // Look up who triggered the change
        const actor = await prisma.user.findUnique({
          where: { id: triggeredBy },
          select: { name: true },
        })
        const actorName = actor?.name ?? 'Sistema'

        const now = new Date()
        const dateLabel = now.toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })
        const timeLabel = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })

        const notifBody = `"${taskTitle}" cambió de ${fromStatus} → ${toStatus} · por ${actorName} el ${dateLabel} a las ${timeLabel}`
        const emailBody = `"${taskTitle}" cambió de estado:\n${fromStatus} → ${toStatus}\n\nPor: ${actorName}\nFecha: ${dateLabel} a las ${timeLabel}`

        await prisma.notification.createMany({
          data: userIds.map((uid: string) => ({
            userId: uid,
            title: auto.name,
            body: notifBody,
            taskId: task.id,
            boardId,
          })),
        })

        // Send email only to members with emailNotifications enabled
        const board = await prisma.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } })
        const members = board ? await prisma.workspaceMember.findMany({
          where: {
            workspaceId: board.workspaceId,
            userId: { in: userIds },
            emailNotifications: true,
          },
          include: { user: { select: { email: true, name: true } } },
        }) : []
        const taskUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/boards/${boardId}?task=${task.id}`
        await Promise.allSettled(
          members.map((m) =>
            sendAlertEmail(m.user.email, m.user.name, auto.name, emailBody, taskUrl),
          ),
        )

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
  const body = await c.req.json().catch(() => null)
  const result = z.string().min(1).max(4000).safeParse(body?.content)
  if (!result.success) return c.json({ error: 'Contenido requerido' }, 400)
  const content = result.data

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      group: { include: { board: true } },
      assignees: { select: { userId: true } },
    },
  })
  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const [membership, assignee] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: task.group.board.workspaceId, userId } },
    }),
    prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId: id, userId } } }),
  ])
  if (!membership && !assignee) return c.json({ error: 'Sin acceso' }, 403)

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { taskId: id, authorId: userId, content },
      include: { author: { select: { id: true, name: true, initials: true, color: true } } },
    }),
    prisma.activity.create({
      data: { taskId: id, userId, action: 'Agregó un comentario' },
    }),
  ])

  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const assigneeIds = task.assignees.map(a => a.userId)
  await notifyUsers({
    userIds: assigneeIds,
    actorId: userId,
    title: 'Nuevo comentario en tu tarea',
    body: `${actor?.name ?? 'Alguien'} comentó en "${task.title}"`,
    taskId: id,
    boardId: task.group.board.id,
    workspaceId: task.group.board.workspaceId,
  })

  return c.json({ comment }, 201)
})

// ── Move task to another board ────────────────────────────────────────────────
taskRoutes.patch('/:id/move', zValidator('json', z.object({ groupId: z.string() })), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { groupId: targetGroupId } = c.req.valid('json')

  // Load task with current board info
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      group: { include: { board: true } },
      assignees: { select: { userId: true } },
    },
  })
  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const sourceBoard = task.group.board

  // Check user is workspace member (or a system admin)
  const isAdmin = await isWorkspaceAdmin(sourceBoard.workspaceId, userId)
  if (!isAdmin) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: sourceBoard.workspaceId, userId } },
    })
    if (!membership) return c.json({ error: 'Sin acceso al workspace' }, 403)
  }

  // Only ADMIN or creator can move
  const isCreator = task.createdBy === userId
  if (!isAdmin && !isCreator) {
    return c.json({ error: 'Solo el creador o un administrador puede mover esta tarea' }, 403)
  }

  // Load target group and board
  const targetGroup = await prisma.group.findUnique({
    where: { id: targetGroupId },
    include: { board: true },
  })
  if (!targetGroup) return c.json({ error: 'Grupo destino no encontrado' }, 404)

  // Must be same workspace
  if (targetGroup.board.workspaceId !== sourceBoard.workspaceId) {
    return c.json({ error: 'No se puede mover entre workspaces distintos' }, 400)
  }

  // Filter assignees: keep only those who are board members of the target board
  const currentAssigneeIds = task.assignees.map(a => a.userId)
  const targetBoardMembers = await prisma.boardMember.findMany({
    where: { boardId: targetGroup.boardId, userId: { in: currentAssigneeIds } },
    select: { userId: true },
  })
  const validAssigneeIds = new Set(targetBoardMembers.map(m => m.userId))
  const removedAssigneeIds = currentAssigneeIds.filter(uid => !validAssigneeIds.has(uid))

  // Validate status against target workspace statuses
  const targetStatuses = await prisma.workspaceStatus.findMany({
    where: { workspaceId: targetGroup.board.workspaceId },
    select: { slug: true },
  })
  const validSlugs = new Set(targetStatuses.map(s => s.slug))
  const newStatus = validSlugs.has(task.status) ? task.status : null

  // Load the destination board's active custom field definitions so orphaned
  // values (fields not defined there) get dropped silently on move, same
  // criterion already applied above to removedAssigneeIds.
  const targetCustomFieldDefs = await prisma.customFieldDefinition.findMany({
    where: { boardId: targetGroup.boardId, archivedAt: null },
    select: { id: true },
  })
  const activeFieldIds = new Set(targetCustomFieldDefs.map(d => d.id))

  // Execute move in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Remove assignees not in target board
    if (removedAssigneeIds.length > 0) {
      await tx.taskAssignee.deleteMany({
        where: { taskId: id, userId: { in: removedAssigneeIds } },
      })
    }

    // Drop customFields keys with no active definition on the target board
    const customFieldsBase: Record<string, unknown> = typeof task.customFields === 'object'
      && task.customFields !== null
      && !Array.isArray(task.customFields)
      ? task.customFields
      : {}
    const filteredCustomFields: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(customFieldsBase)) {
      if (activeFieldIds.has(key)) filteredCustomFields[key] = value
    }

    // Update task group and status
    const moved = await tx.task.update({
      where: { id },
      data: {
        groupId: targetGroupId,
        customFields: filteredCustomFields as Prisma.InputJsonValue,
        ...(newStatus !== task.status && { status: newStatus ?? 'Nuevo' }),
        activities: {
          create: {
            userId,
            action: `Movió la tarea de "${sourceBoard.name}" a "${targetGroup.board.name}"`,
          },
        },
      },
      include: taskInclude,
    })

    return moved
  })

  return c.json({ task: updated })
})
