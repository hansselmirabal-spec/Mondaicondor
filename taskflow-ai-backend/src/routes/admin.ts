import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendInviteEmail } from '../lib/email.js'
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
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  name: z.string().min(2).optional(),
  password: z.string().min(8).optional(),
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
  const { email, role, name, password } = c.req.valid('json')

  if (!await assertAdmin(workspaceId, userId)) {
    return c.json({ error: 'Solo admins pueden agregar usuarios' }, 403)
  }

  const [workspace, actor] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ])
  const workspaceName = workspace?.name ?? 'TaskFlow AI'
  const actorName = actor?.name ?? 'Un administrador'
  const roleLabel = role === 'ADMIN' ? 'Administrador' : role === 'VIEWER' ? 'Visualizador' : 'Miembro'
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const loginUrl = `${appUrl}/login`

  function notifyMember(addedUserId: string) {
    prisma.notification.create({
      data: {
        userId: addedUserId,
        title: `Te agregaron a ${workspaceName}`,
        body: `${actorName} te agregó al workspace ${workspaceName} como ${roleLabel}.`,
        taskId: null,
        boardId: null,
      },
    }).catch((err) => {
      console.error('[notification] create failed:', err?.message ?? err)
    })
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
    sendInviteEmail(email, workspaceName, loginUrl, role).catch((err) => {
      console.error('[email] invite send failed:', err?.message ?? err)
    })
    notifyMember(existing.id)
    return c.json({ member }, 201)
  }

  const memberInclude = {
    user: { select: { id: true, name: true, email: true, initials: true, color: true, createdAt: true } },
  } satisfies Prisma.WorkspaceMemberInclude

  let tempPassword: string | undefined
  let member: Prisma.WorkspaceMemberGetPayload<{ include: typeof memberInclude }>

  if (name && password) {
    // Deliberate create with explicit name + password (backward compat).
    const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
    const colors = ['#e2445c', '#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#00c2cd', '#ff7575', '#037f4c']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const passwordHash = await bcrypt.hash(password, 12)

    member = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, initials, color, passwordHash },
      })
      return tx.workspaceMember.create({
        data: { workspaceId, userId: user.id, role },
        include: memberInclude,
      })
    })
  } else {
    // Auto-provision: no name/password given, create the account with a temp password.
    tempPassword = randomBytes(5).toString('hex')
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const derivedName = email.split('@')[0]
    const initials = derivedName.slice(0, 2).toUpperCase()

    member = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: derivedName, email, initials, passwordHash, mustChangePassword: true },
      })
      return tx.workspaceMember.create({
        data: { workspaceId, userId: user.id, role },
        include: memberInclude,
      })
    })
  }

  sendInviteEmail(email, workspaceName, loginUrl, role, tempPassword).catch((err) => {
    console.error('[email] invite send failed:', err?.message ?? err)
  })
  notifyMember(member.userId)
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
