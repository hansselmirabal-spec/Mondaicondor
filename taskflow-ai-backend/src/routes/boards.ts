import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { isWorkspaceAdmin, isBoardAdmin } from '../lib/authz.js'
import type { AppEnv } from '../lib/types.js'

export const boardRoutes = new Hono<AppEnv>()

boardRoutes.use('*', authMiddleware)

const createBoardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workspaceId: z.string(),
  isPrivate: z.boolean().optional().default(false),
})

const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
})

const createGroupSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateBoardSettingsSchema = z.object({
  defaultStatus: z.enum(['Nuevo', 'Asignado', 'EnProgreso', 'EnRevision', 'Bloqueado', 'Completado', 'AlwaysOn']).optional(),
  defaultPriority: z.enum(['Baja', 'Media', 'Alta', 'Critica', 'AlwaysOn']).optional(),
})

const addBoardMemberSchema = z.object({ userId: z.string() })

const customFieldOptionInputSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const createCustomFieldSchema = z.object({
  label: z.string().min(1).max(60),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX']),
  config: z.object({ options: z.array(customFieldOptionInputSchema).optional() }).optional(),
})

const updateCustomFieldSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX']).optional(),
  config: z.object({
    options: z.array(customFieldOptionInputSchema.extend({ id: z.string().optional() })).optional(),
  }).optional(),
})

const reorderCustomFieldsSchema = z.object({ order: z.array(z.string()) })

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
}

// Returns the board if user can access it, null otherwise.
// System (app) admins always see all boards, even without a WorkspaceMember row.
// Workspace ADMINs always see all boards.
// Public boards: any workspace member.
// Private boards: workspace member + explicit BoardMember entry.
async function assertBoardAccess(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { boardMembers: { where: { userId } } },
  })
  if (!board) return null

  const [wsMembership, user] = await Promise.all([
    getWorkspaceMembership(board.workspaceId, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } }),
  ])

  if (user?.isAppAdmin) return { board, wsMembership: wsMembership ?? { role: 'ADMIN' as const } }

  if (!wsMembership) return null

  if (wsMembership.role === 'ADMIN') return { board, wsMembership }
  if (!board.isPrivate) return { board, wsMembership }
  if (board.boardMembers.length > 0) return { board, wsMembership }

  return null
}

// ── List boards in workspace ────────────────────────────────────────────────
boardRoutes.get('/workspace/:workspaceId', async (c) => {
  const { userId } = c.get('user')
  const { workspaceId } = c.req.param()

  const [membership, user] = await Promise.all([
    getWorkspaceMembership(workspaceId, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } }),
  ])
  if (!membership && !user?.isAppAdmin) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const isAdmin = membership?.role === 'ADMIN' || user?.isAppAdmin === true

  const boards = await prisma.board.findMany({
    where: {
      workspaceId,
      OR: isAdmin ? undefined : [
        { isPrivate: false },
        { isPrivate: true, boardMembers: { some: { userId } } },
      ],
    },
    include: {
      _count: { select: { groups: true } },
      boardMembers: { select: { userId: true } },
      groups: { select: { id: true, name: true, color: true, order: true }, orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return c.json({ boards })
})

// ── Create board ────────────────────────────────────────────────────────────
boardRoutes.post('/', zValidator('json', createBoardSchema), async (c) => {
  const { userId } = c.get('user')
  const { name, description, workspaceId, isPrivate } = c.req.valid('json')

  const [membership, user] = await Promise.all([
    getWorkspaceMembership(workspaceId, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } }),
  ])
  if (!membership && !user?.isAppAdmin) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const board = await prisma.board.create({
    data: {
      name,
      description,
      workspaceId,
      isPrivate: isPrivate ?? false,
      settings: { create: { updatedAt: new Date() } },
      groups: { create: [{ name: 'Tareas', color: '#6366f1', order: 0 }] },
      // creator is always a board member (so they keep access if it's private)
      // and is the real ADMIN of this board from the moment it's created.
      boardMembers: { create: { userId, role: 'ADMIN' } },
    },
    include: { settings: true, groups: { orderBy: { order: 'asc' } }, boardMembers: true },
  })

  return c.json({ board }, 201)
})

// ── Get board ───────────────────────────────────────────────────────────────
boardRoutes.get('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { order: 'asc' } },
      settings: true,
      boardMembers: {
        include: { user: { select: { id: true, name: true, email: true, initials: true, color: true, avatarUrl: true } } },
      },
    },
  })

  return c.json({ board })
})

// ── Update board ────────────────────────────────────────────────────────────
boardRoutes.put('/:id', zValidator('json', updateBoardSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const updated = await prisma.board.update({ where: { id }, data })
  return c.json({ board: updated })
})

// ── Delete board ────────────────────────────────────────────────────────────
boardRoutes.delete('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (!await isWorkspaceAdmin(access.board.workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden eliminar tableros' }, 403)
  }

  await prisma.board.delete({ where: { id } })
  return c.json({ message: 'Board eliminado' })
})

// ── Board settings ──────────────────────────────────────────────────────────
boardRoutes.put('/:id/settings', zValidator('json', updateBoardSettingsSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const settings = await prisma.boardSettings.upsert({
    where: { boardId: id },
    update: { ...data, updatedAt: new Date() },
    create: { boardId: id, ...data, updatedAt: new Date() },
  })

  return c.json({ settings })
})

// ── Board members ───────────────────────────────────────────────────────────
boardRoutes.get('/:id/members', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)

  const members = await prisma.boardMember.findMany({
    where: { boardId: id },
    include: { user: { select: { id: true, name: true, email: true, initials: true, color: true, avatarUrl: true } } },
  })

  return c.json({ members })
})

boardRoutes.post('/:id/members', zValidator('json', addBoardMemberSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { userId: targetUserId } = c.req.valid('json')

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  // Target must be a workspace member
  const targetMembership = await getWorkspaceMembership(access.board.workspaceId, targetUserId)
  if (!targetMembership) return c.json({ error: 'El usuario no pertenece al workspace' }, 400)

  const member = await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: id, userId: targetUserId } },
    update: {},
    create: { boardId: id, userId: targetUserId },
    include: { user: { select: { id: true, name: true, email: true, initials: true, color: true, avatarUrl: true } } },
  })

  return c.json({ member }, 201)
})

boardRoutes.delete('/:id/members/:targetUserId', async (c) => {
  const { userId } = c.get('user')
  const { id, targetUserId } = c.req.param()

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  try {
    await prisma.boardMember.delete({ where: { boardId_userId: { boardId: id, userId: targetUserId } } })
  } catch {
    return c.json({ error: 'Miembro no encontrado' }, 404)
  }

  return c.json({ message: 'Miembro eliminado del tablero' })
})

// ── Groups ──────────────────────────────────────────────────────────────────
boardRoutes.post('/:id/groups', zValidator('json', createGroupSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { name, color } = c.req.valid('json')

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const count = await prisma.group.count({ where: { boardId: id } })
  const group = await prisma.group.create({
    data: { name, color: color ?? '#6366f1', boardId: id, order: count },
  })

  return c.json({ group }, 201)
})

boardRoutes.put('/groups/:groupId', zValidator('json', updateGroupSchema), async (c) => {
  const { userId } = c.get('user')
  const { groupId } = c.req.param()
  const data = c.req.valid('json')

  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { board: true } })
  if (!group) return c.json({ error: 'Grupo no encontrado' }, 404)

  const access = await assertBoardAccess(group.boardId, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const updated = await prisma.group.update({ where: { id: groupId }, data })
  return c.json({ group: updated })
})

boardRoutes.delete('/groups/:groupId', async (c) => {
  const { userId } = c.get('user')
  const { groupId } = c.req.param()

  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { board: true } })
  if (!group) return c.json({ error: 'Grupo no encontrado' }, 404)

  const access = await assertBoardAccess(group.boardId, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  await prisma.group.delete({ where: { id: groupId } })
  return c.json({ message: 'Grupo eliminado' })
})

// ── Reorder tasks within a group ────────────────────────────────────────────
boardRoutes.put('/groups/:groupId/tasks/reorder', zValidator('json', z.object({ order: z.array(z.string()) })), async (c) => {
  const { userId } = c.get('user')
  const { groupId } = c.req.param()
  const { order } = c.req.valid('json')

  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { board: true } })
  if (!group) return c.json({ error: 'Grupo no encontrado' }, 404)

  const access = await assertBoardAccess(group.boardId, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  await prisma.$transaction(
    order.map((id, index) => prisma.task.update({ where: { id }, data: { order: index } }))
  )

  return c.json({ message: 'Orden actualizado' })
})

// ── Reorder groups ──────────────────────────────────────────────────────────
boardRoutes.put('/:boardId/groups/reorder', zValidator('json', z.object({ order: z.array(z.string()) })), async (c) => {
  const { userId } = c.get('user')
  const { boardId } = c.req.param()
  const { order } = c.req.valid('json')

  const access = await assertBoardAccess(boardId, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)
  if (access.wsMembership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  await prisma.$transaction(
    order.map((id, index) => prisma.group.update({ where: { id }, data: { order: index } }))
  )

  return c.json({ message: 'Orden actualizado' })
})

// ── Custom Field Definitions ────────────────────────────────────────────────
// Read endpoints use assertBoardAccess (any member with board access can list).
// Write endpoints use isBoardAdmin (real board ADMIN, or workspace ADMIN as
// fallback for public boards without an explicit BoardMember row).

type CustomFieldOption = {
  id: string
  label: string
  color: string
  order: number
  archivedAt: string | null
}

type CustomFieldConfig = {
  options?: CustomFieldOption[]
}

function asCustomFieldConfig(config: unknown): CustomFieldConfig {
  return config && typeof config === 'object' && !Array.isArray(config) ? (config as CustomFieldConfig) : {}
}

function getConfigOptions(config: unknown): CustomFieldOption[] {
  const options = asCustomFieldConfig(config).options
  return Array.isArray(options) ? options : []
}

// Whether any task on this board has a stored value for fieldId, using
// Postgres's jsonb "?" key-exists operator instead of pulling every task in
// the board and filtering in JS. Verified against this project's Prisma
// version (5.22, default query engine): a bare "?" here is NOT parsed as a
// bind placeholder by $queryRaw (only "${}" is), so it passes through as
// literal SQL. Doubling it as "??" (per some Prisma docs for older/other
// engines) instead produces a real Postgres syntax error here
// ("operator does not exist: jsonb ?? text") — confirmed by manual testing.
async function fieldHasValues(boardId: string, fieldId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM "Task" t
      JOIN "Group" g ON g.id = t."groupId"
      WHERE g."boardId" = ${boardId} AND t."customFields" ? ${fieldId}
    ) as exists
  `
  return rows[0]?.exists ?? false
}

boardRoutes.get('/:id/custom-fields', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const includeArchived = c.req.query('includeArchived') === 'true'

  const access = await assertBoardAccess(id, userId)
  if (!access) return c.json({ error: 'Sin acceso' }, 403)

  const definitions = await prisma.customFieldDefinition.findMany({
    where: includeArchived ? { boardId: id } : { boardId: id, archivedAt: null },
    orderBy: { order: 'asc' },
  })

  // hasValues for every definition in one query (avoid N+1).
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    SELECT DISTINCT jsonb_object_keys(t."customFields") as key
    FROM "Task" t
    JOIN "Group" g ON g.id = t."groupId"
    WHERE g."boardId" = ${id}
  `
  const fieldIdsWithValues = new Set(rows.map(r => r.key))

  const customFieldDefinitions = definitions.map(def => ({
    ...def,
    hasValues: fieldIdsWithValues.has(def.id),
  }))

  return c.json({ customFieldDefinitions })
})

boardRoutes.post('/:id/custom-fields', zValidator('json', createCustomFieldSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { label, type, config } = c.req.valid('json')

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  const count = await prisma.customFieldDefinition.count({ where: { boardId: id } })

  const finalConfig: CustomFieldConfig =
    type === 'SELECT' && config?.options
      ? {
          options: config.options.map((opt, idx) => ({
            id: randomUUID(),
            label: opt.label,
            color: opt.color,
            order: idx,
            archivedAt: null,
          })),
        }
      : {}

  const customField = await prisma.customFieldDefinition.create({
    data: { boardId: id, label, type, config: finalConfig, order: count },
  })

  return c.json({ customField }, 201)
})

// Static path registered before the dynamic :fieldId routes below so it
// can't be shadowed by them.
boardRoutes.put('/:id/custom-fields/reorder', zValidator('json', reorderCustomFieldsSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { order } = c.req.valid('json')

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  await prisma.$transaction(
    order.map((fieldId, idx) =>
      prisma.customFieldDefinition.updateMany({ where: { id: fieldId, boardId: id }, data: { order: idx } })
    )
  )

  const customFieldDefinitions = await prisma.customFieldDefinition.findMany({
    where: { boardId: id },
    orderBy: { order: 'asc' },
  })

  return c.json({ customFieldDefinitions })
})

boardRoutes.put('/:id/custom-fields/:fieldId', zValidator('json', updateCustomFieldSchema), async (c) => {
  const { userId } = c.get('user')
  const { id, fieldId } = c.req.param()
  const data = c.req.valid('json')

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  const target = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } })
  if (!target || target.boardId !== id) return c.json({ error: 'Campo no encontrado' }, 404)

  if (data.type && data.type !== target.type && await fieldHasValues(id, fieldId)) {
    return c.json(
      { error: 'No se puede cambiar el tipo de un campo que ya tiene valores cargados. Creá un campo nuevo y archivá este.' },
      409
    )
  }

  // Merge SELECT options by id: options with a known id get label/color
  // updated in place, options without an id are created new. No option is
  // ever removed here — archiving an option is a separate endpoint.
  let nextConfig: CustomFieldConfig | undefined
  if (data.config?.options) {
    const existingOptions = getConfigOptions(target.config)
    const byId = new Map(existingOptions.map(o => [o.id, o]))
    let nextOrder = existingOptions.length

    for (const opt of data.config.options) {
      if (opt.id && byId.has(opt.id)) {
        const current = byId.get(opt.id)!
        byId.set(opt.id, { ...current, label: opt.label, color: opt.color })
      } else {
        const optId = randomUUID()
        byId.set(optId, { id: optId, label: opt.label, color: opt.color, order: nextOrder, archivedAt: null })
        nextOrder += 1
      }
    }

    nextConfig = { ...asCustomFieldConfig(target.config), options: Array.from(byId.values()).sort((a, b) => a.order - b.order) }
  }

  const customField = await prisma.customFieldDefinition.update({
    where: { id: fieldId },
    data: {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(nextConfig !== undefined ? { config: nextConfig } : {}),
    },
  })

  return c.json({ customField })
})

boardRoutes.put('/:id/custom-fields/:fieldId/options/:optionId/archive', async (c) => {
  const { userId } = c.get('user')
  const { id, fieldId, optionId } = c.req.param()

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  const target = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } })
  if (!target || target.boardId !== id) return c.json({ error: 'Campo no encontrado' }, 404)

  const options = getConfigOptions(target.config)
  if (!options.some(o => o.id === optionId)) return c.json({ error: 'Opción no encontrada' }, 404)

  const nextOptions = options.map(o => (o.id === optionId ? { ...o, archivedAt: new Date().toISOString() } : o))

  const customField = await prisma.customFieldDefinition.update({
    where: { id: fieldId },
    data: { config: { ...asCustomFieldConfig(target.config), options: nextOptions } },
  })

  return c.json({ customField })
})

boardRoutes.put('/:id/custom-fields/:fieldId/unarchive', async (c) => {
  const { userId } = c.get('user')
  const { id, fieldId } = c.req.param()

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  const target = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } })
  if (!target || target.boardId !== id) return c.json({ error: 'Campo no encontrado' }, 404)

  const customField = await prisma.customFieldDefinition.update({ where: { id: fieldId }, data: { archivedAt: null } })
  return c.json({ customField })
})

boardRoutes.delete('/:id/custom-fields/:fieldId', async (c) => {
  const { userId } = c.get('user')
  const { id, fieldId } = c.req.param()

  if (!await isBoardAdmin(id, userId)) return c.json({ error: 'Sin permisos' }, 403)

  const target = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } })
  if (!target || target.boardId !== id) return c.json({ error: 'Campo no encontrado' }, 404)

  // Soft delete: unlike WorkspaceStatus, this never blocks on usage — an
  // archived field just stops being listed/editable by default; its values
  // stay in Task.customFields.
  await prisma.customFieldDefinition.update({ where: { id: fieldId }, data: { archivedAt: new Date() } })
  return c.json({ message: 'Campo archivado' })
})
