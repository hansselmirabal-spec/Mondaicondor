import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const adminRoutes = new Hono<AppEnv>()

adminRoutes.use('*', authMiddleware)

async function assertAdmin(workspaceId: string, userId: string) {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return m?.role === 'ADMIN' ? m : null
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
})

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional(),
})

adminRoutes.get('/workspaces/:workspaceId/users', async (c) => {
  const { userId } = c.get('user')
  const { workspaceId } = c.req.param()

  if (!await assertAdmin(workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden ver esta sección' }, 403)
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return c.json({ members })
})

adminRoutes.post('/workspaces/:workspaceId/users', zValidator('json', createUserSchema), async (c) => {
  const { userId } = c.get('user')
  const { workspaceId } = c.req.param()
  const { name, email, password, role } = c.req.valid('json')

  if (!await assertAdmin(workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden crear usuarios' }, 403)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const alreadyMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existing.id } },
    })
    if (alreadyMember) return c.json({ error: 'El usuario ya es miembro de este workspace' }, 409)

    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: existing.id, role },
      include: { user: { select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true } } },
    })
    return c.json({ member }, 201)
  }

  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
  const colors = ['#e2445c', '#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#00c2cd', '#ff7575', '#037f4c']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const passwordHash = await bcrypt.hash(password, 12)

  const member = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, initials, color, passwordHash },
    })
    return tx.workspaceMember.create({
      data: { workspaceId, userId: user.id, role },
      include: { user: { select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true } } },
    })
  })

  return c.json({ member }, 201)
})

adminRoutes.put('/workspaces/:workspaceId/users/:targetUserId', zValidator('json', updateUserSchema), async (c) => {
  const { userId } = c.get('user')
  const { workspaceId, targetUserId } = c.req.param()
  const { name, email, color, role } = c.req.valid('json')

  if (!await assertAdmin(workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden editar usuarios' }, 403)
  }

  if (role && targetUserId === userId) {
    return c.json({ error: 'No podés cambiar tu propio rol' }, 400)
  }

  const profileUpdates: Record<string, unknown> = {}
  if (name) {
    profileUpdates.name = name
    profileUpdates.initials = name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
  }
  if (email) profileUpdates.email = email
  if (color) profileUpdates.color = color

  const [user] = await prisma.$transaction([
    Object.keys(profileUpdates).length > 0
      ? prisma.user.update({ where: { id: targetUserId }, data: profileUpdates, select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true } })
      : prisma.user.findUniqueOrThrow({ where: { id: targetUserId }, select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true } }),
    ...(role ? [prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } }, data: { role } })] : []),
  ])

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })

  return c.json({ member: { userId: targetUserId, role: membership?.role, user } })
})

adminRoutes.delete('/workspaces/:workspaceId/users/:targetUserId', async (c) => {
  const { userId } = c.get('user')
  const { workspaceId, targetUserId } = c.req.param()

  if (!await assertAdmin(workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden eliminar usuarios' }, 403)
  }

  if (targetUserId === userId) {
    return c.json({ error: 'No podés eliminarte a vos mismo' }, 400)
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })

  return c.json({ message: 'Usuario removido del workspace' })
})
