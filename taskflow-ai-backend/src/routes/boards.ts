import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const boardRoutes = new Hono<AppEnv>()

boardRoutes.use('*', authMiddleware)

const createBoardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workspaceId: z.string(),
})

const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

const createGroupSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateBoardSettingsSchema = z.object({
  defaultStatus: z.enum(['Nuevo', 'Asignado', 'EnProgreso', 'EnRevision', 'Bloqueado', 'Completado', 'AlwaysOn']).optional(),
  defaultPriority: z.enum(['Baja', 'Media', 'Alta', 'Critica', 'AlwaysOn']).optional(),
})

async function assertWorkspaceAccess(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
}

boardRoutes.get('/workspace/:workspaceId', async (c) => {
  const { userId } = c.get('user')
  const { workspaceId } = c.req.param()

  const membership = await assertWorkspaceAccess(workspaceId, userId)
  if (!membership) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const boards = await prisma.board.findMany({
    where: { workspaceId },
    include: { _count: { select: { groups: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return c.json({ boards })
})

boardRoutes.post('/', zValidator('json', createBoardSchema), async (c) => {
  const { userId } = c.get('user')
  const { name, description, workspaceId } = c.req.valid('json')

  const membership = await assertWorkspaceAccess(workspaceId, userId)
  if (!membership) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const board = await prisma.board.create({
    data: {
      name,
      description,
      workspaceId,
      settings: { create: { updatedAt: new Date() } },
      groups: { create: [{ name: 'Tareas', color: '#6366f1', order: 0 }] },
    },
    include: { settings: true, groups: { orderBy: { order: 'asc' } } },
  })

  return c.json({ board }, 201)
})

boardRoutes.get('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      groups: {
        include: {
          tasks: {
            include: {
              assignees: { include: { user: { select: { id: true, name: true, initials: true, color: true } } } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
      settings: true,
    },
  })

  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await assertWorkspaceAccess(board.workspaceId, userId)
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  return c.json({ board })
})

boardRoutes.put('/:id', zValidator('json', updateBoardSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const board = await prisma.board.findUnique({ where: { id } })
  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await assertWorkspaceAccess(board.workspaceId, userId)
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos' }, 403)
  }

  const updated = await prisma.board.update({ where: { id }, data })
  return c.json({ board: updated })
})

boardRoutes.delete('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const board = await prisma.board.findUnique({ where: { id } })
  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await assertWorkspaceAccess(board.workspaceId, userId)
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden eliminar boards' }, 403)
  }

  await prisma.board.delete({ where: { id } })
  return c.json({ message: 'Board eliminado' })
})

boardRoutes.put('/:id/settings', zValidator('json', updateBoardSettingsSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const board = await prisma.board.findUnique({ where: { id } })
  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await assertWorkspaceAccess(board.workspaceId, userId)
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos' }, 403)
  }

  const settings = await prisma.boardSettings.upsert({
    where: { boardId: id },
    update: { ...data, updatedAt: new Date() },
    create: { boardId: id, ...data, updatedAt: new Date() },
  })

  return c.json({ settings })
})

boardRoutes.post('/:id/groups', zValidator('json', createGroupSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { name, color } = c.req.valid('json')

  const board = await prisma.board.findUnique({ where: { id } })
  if (!board) return c.json({ error: 'Board no encontrado' }, 404)

  const membership = await assertWorkspaceAccess(board.workspaceId, userId)
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos' }, 403)
  }

  const count = await prisma.group.count({ where: { boardId: id } })
  const group = await prisma.group.create({
    data: { name, color: color ?? '#6366f1', boardId: id, order: count },
  })

  return c.json({ group }, 201)
})
