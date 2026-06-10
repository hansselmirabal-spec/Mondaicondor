import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendInviteEmail } from '../lib/email.js'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import type { AppEnv } from '../lib/types.js'

export const workspaceRoutes = new Hono<AppEnv>()

workspaceRoutes.use('*', authMiddleware)

const DEFAULT_STATUSES = [
  { slug: 'Nuevo',      label: 'Nuevo',       color: '#c4c4c4', position: 0, isDefault: true  },
  { slug: 'Asignado',   label: 'Asignado',    color: '#e2445c', position: 1, isDefault: false },
  { slug: 'EnProgreso', label: 'En progreso', color: '#579bfc', position: 2, isDefault: false },
  { slug: 'EnRevision', label: 'En revisión', color: '#a25ddc', position: 3, isDefault: false },
  { slug: 'Bloqueado',  label: 'Bloqueado',   color: '#bb3354', position: 4, isDefault: false },
  { slug: 'Completado', label: 'Completado',  color: '#00c875', position: 5, isDefault: false },
  { slug: 'AlwaysOn',   label: 'Always On',   color: '#00c2cd', position: 6, isDefault: false },
]

async function seedDefaultStatuses(workspaceId: string) {
  return prisma.workspaceStatus.createMany({
    data: DEFAULT_STATUSES.map(s => ({ ...s, workspaceId })),
    skipDuplicates: true,
  })
}

const createWorkspaceSchema = z.object({
  name: z.string().min(2),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
  sendEmail: z.boolean().optional().default(false),
})

const updateSettingsSchema = z.object({
  timezone: z.string().optional(),
  language: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
})

workspaceRoutes.get('/', async (c) => {
  const { userId } = c.get('user')

  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true, role: true } },
      _count: { select: { boards: true } },
    },
  })

  return c.json({ workspaces })
})

workspaceRoutes.post('/', zValidator('json', createWorkspaceSchema), async (c) => {
  const { userId } = c.get('user')
  const { name, color } = c.req.valid('json')

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const uniqueSlug = `${slug}-${Date.now()}`

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: uniqueSlug,
      color: color ?? '#6366f1',
      members: {
        create: { userId, role: 'ADMIN' },
      },
      settings: {
        create: { updatedAt: new Date() },
      },
    },
    include: { members: true, settings: true },
  })

  await seedDefaultStatuses(workspace.id)

  return c.json({ workspace }, 201)
})

workspaceRoutes.get('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: {
        select: {
          id: true,
          userId: true,
          role: true,
          joinedAt: true,
          emailNotifications: true,
          user: { select: { id: true, name: true, email: true, initials: true, color: true } },
        },
      },
      settings: true,
      _count: { select: { boards: true } },
    },
  })

  if (!workspace) return c.json({ error: 'Workspace no encontrado' }, 404)
  return c.json({ workspace })
})

workspaceRoutes.put('/:id', zValidator('json', updateWorkspaceSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden editar el workspace' }, 403)
  }

  const workspace = await prisma.workspace.update({ where: { id }, data })
  return c.json({ workspace })
})

workspaceRoutes.delete('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden eliminar el workspace' }, 403)
  }

  await prisma.workspace.delete({ where: { id } })
  return c.json({ message: 'Workspace eliminado' })
})

workspaceRoutes.post('/:id/invite', zValidator('json', inviteSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { email, role, sendEmail } = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role === 'VIEWER') {
    return c.json({ error: 'Sin permisos para invitar' }, 403)
  }

  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { name: true } })

  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId: id, email } },
    update: { role, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), acceptedAt: null },
    create: {
      workspaceId: id,
      email,
      role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const loginUrl = `${appUrl}/login`

  // If the user doesn't exist yet, create the account with a temp password
  let tempPassword: string | undefined
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (!existingUser) {
    tempPassword = randomBytes(5).toString('hex') // e.g. "a3f8c1d2e5"
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const name = email.split('@')[0]
    const initials = name.slice(0, 2).toUpperCase()
    const newUser = await prisma.user.create({
      data: { email, name, initials, passwordHash, mustChangePassword: true },
    })
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: id, userId: newUser.id } },
      update: { role },
      create: { workspaceId: id, userId: newUser.id, role },
    })
  }

  if (sendEmail) {
    try {
      await sendInviteEmail(email, workspace?.name ?? 'TaskFlow AI', loginUrl, role, tempPassword)
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr)
    }
  }

  return c.json({ invite, inviteUrl: `/workspaces/accept/${invite.token}` }, 201)
})

workspaceRoutes.post('/accept/:token', async (c) => {
  const { userId } = c.get('user')
  const { token } = c.req.param()

  const invite = await prisma.workspaceInvite.findUnique({ where: { token } })
  if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
    return c.json({ error: 'Invitación inválida o expirada' }, 400)
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.email !== invite.email) {
    return c.json({ error: 'Esta invitación es para otro email' }, 403)
  }

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      update: {},
    }),
    prisma.workspaceInvite.update({
      where: { token },
      data: { acceptedAt: new Date() },
    }),
  ])

  return c.json({ message: 'Te uniste al workspace' })
})

workspaceRoutes.put('/:id/members/:memberId', zValidator('json', z.object({ role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']) })), async (c) => {
  const { userId } = c.get('user')
  const { id, memberId } = c.req.param()
  const { role } = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden cambiar roles' }, 403)
  }

  if (memberId === userId) {
    return c.json({ error: 'No podés cambiar tu propio rol' }, 400)
  }

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: id, userId: memberId } },
    data: { role },
  })

  return c.json({ member: updated })
})

workspaceRoutes.delete('/:id/members/:memberId', async (c) => {
  const { userId } = c.get('user')
  const { id, memberId } = c.req.param()

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden remover miembros' }, 403)
  }

  if (memberId === userId) {
    return c.json({ error: 'No podés removerte a vos mismo' }, 400)
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: id, userId: memberId } },
  })

  return c.json({ message: 'Miembro removido' })
})

// ── Workspace Statuses ──────────────────────────────────────────────────────

const createStatusSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

const updateStatusSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const reorderSchema = z.object({
  order: z.array(z.string()), // array of status IDs in new order
})

workspaceRoutes.get('/:id/statuses', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership) return c.json({ error: 'Sin acceso' }, 403)

  let statuses = await prisma.workspaceStatus.findMany({
    where: { workspaceId: id },
    orderBy: { position: 'asc' },
  })

  if (statuses.length === 0) {
    await seedDefaultStatuses(id)
    statuses = await prisma.workspaceStatus.findMany({
      where: { workspaceId: id },
      orderBy: { position: 'asc' },
    })
  }

  return c.json({ statuses })
})

workspaceRoutes.post('/:id/statuses', zValidator('json', createStatusSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { label, color } = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const existing = await prisma.workspaceStatus.findMany({ where: { workspaceId: id } })
  const slug = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

  const status = await prisma.workspaceStatus.create({
    data: { workspaceId: id, slug, label, color, position: existing.length },
  })

  return c.json({ status }, 201)
})

workspaceRoutes.put('/:id/statuses/reorder', zValidator('json', reorderSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const { order } = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  await prisma.$transaction(
    order.map((statusId, idx) =>
      prisma.workspaceStatus.updateMany({
        where: { id: statusId, workspaceId: id },
        data: { position: idx },
      })
    )
  )

  const statuses = await prisma.workspaceStatus.findMany({
    where: { workspaceId: id },
    orderBy: { position: 'asc' },
  })

  return c.json({ statuses })
})

workspaceRoutes.put('/:id/statuses/:statusId', zValidator('json', updateStatusSchema), async (c) => {
  const { userId } = c.get('user')
  const { id, statusId } = c.req.param()
  const data = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role === 'VIEWER') return c.json({ error: 'Sin permisos' }, 403)

  const status = await prisma.workspaceStatus.update({
    where: { id: statusId },
    data,
  })

  return c.json({ status })
})

workspaceRoutes.delete('/:id/statuses/:statusId', async (c) => {
  const { userId } = c.get('user')
  const { id, statusId } = c.req.param()

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') return c.json({ error: 'Solo admins pueden eliminar estados' }, 403)

  const target = await prisma.workspaceStatus.findUnique({ where: { id: statusId } })
  if (!target || target.workspaceId !== id) return c.json({ error: 'Estado no encontrado' }, 404)

  const usageCount = await prisma.task.count({
    where: { status: target.slug, group: { board: { workspaceId: id } } },
  })
  if (usageCount > 0) {
    return c.json({ error: `Este estado tiene ${usageCount} tarea(s). Reasigná las tareas antes de eliminarlo.` }, 409)
  }

  await prisma.workspaceStatus.delete({ where: { id: statusId } })
  return c.json({ message: 'Estado eliminado' })
})

// ── Email Notifications ──────────────────────────────────────────────────────

workspaceRoutes.put('/:id/members/:memberId/email-notifications',
  zValidator('json', z.object({ enabled: z.boolean() })),
  async (c) => {
    const { userId } = c.get('user')
    const { id, memberId } = c.req.param()
    const { enabled } = c.req.valid('json')

    const callerMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    })
    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return c.json({ error: 'Solo admins pueden cambiar esta configuración' }, 403)
    }

    const updated = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: id, userId: memberId } },
      data: { emailNotifications: enabled },
    })

    return c.json({ member: { userId: updated.userId, emailNotifications: updated.emailNotifications } })
  }
)

// ── Workspace Settings ───────────────────────────────────────────────────────

workspaceRoutes.put('/:id/settings', zValidator('json', updateSettingsSchema), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return c.json({ error: 'Solo admins pueden cambiar la configuración' }, 403)
  }

  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId: id },
    update: { ...data, updatedAt: new Date() },
    create: { workspaceId: id, ...data, updatedAt: new Date() },
  })

  return c.json({ settings })
})
