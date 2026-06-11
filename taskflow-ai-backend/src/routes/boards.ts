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

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
}

// Returns the board if user can access it, null otherwise.
// Workspace ADMINs always see all boards.
// Public boards: any workspace member.
// Private boards: workspace member + explicit BoardMember entry.
async function assertBoardAccess(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { boardMembers: { where: { userId } } },
  })
  if (!board) return null

  const wsMembership = await getWorkspaceMembership(board.workspaceId, userId)
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

  const membership = await getWorkspaceMembership(workspaceId, userId)
  if (!membership) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const isAdmin = membership.role === 'ADMIN'

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
    },
    orderBy: { createdAt: 'asc' },
  })

  return c.json({ boards })
})

// ── Create board ────────────────────────────────────────────────────────────
boardRoutes.post('/', zValidator('json', createBoardSchema), async (c) => {
  const { userId } = c.get('user')
  const { name, description, workspaceId, isPrivate } = c.req.valid('json')

  const membership = await getWorkspaceMembership(workspaceId, userId)
  if (!membership) return c.json({ error: 'Sin acceso al workspace' }, 403)

  const board = await prisma.board.create({
    data: {
      name,
      description,
      workspaceId,
      isPrivate: isPrivate ?? false,
      settings: { create: { updatedAt: new Date() } },
      groups: { create: [{ name: 'Tareas', color: '#6366f1', order: 0 }] },
      // creator is always a board member (so they keep access if it's private)
      boardMembers: { create: { userId } },
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
  if (access.wsMembership.role !== 'ADMIN') return c.json({ error: 'Solo admins pueden eliminar tableros' }, 403)

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
