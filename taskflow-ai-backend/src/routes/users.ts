import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const userRoutes = new Hono<AppEnv>()

userRoutes.use('*', authMiddleware)

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().optional(),
  emailNotifications: z.boolean().optional(),
})

userRoutes.get('/list', async (c) => {
  const { userId } = c.get('user')

  const memberOf = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  })
  const workspaceIds = memberOf.map(m => m.workspaceId)

  const users = await prisma.user.findMany({
    where: {
      memberships: {
        some: { workspaceId: { in: workspaceIds } },
      },
    },
    select: { id: true, name: true, email: true, initials: true, color: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  })
  return c.json({ users })
})

userRoutes.get('/search', async (c) => {
  const { userId } = c.get('user')
  const email = c.req.query('email')
  if (!email) return c.json({ user: null })

  const memberOf = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  })
  const workspaceIds = memberOf.map(m => m.workspaceId)

  const user = await prisma.user.findFirst({
    where: {
      email,
      memberships: {
        some: { workspaceId: { in: workspaceIds } },
      },
    },
    select: { id: true, name: true, email: true, initials: true, color: true, avatarUrl: true },
  })

  return c.json({ user: user ?? null })
})

userRoutes.get('/me', async (c) => {
  const { userId } = c.get('user')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      initials: true,
      color: true,
      avatarUrl: true,
      mustChangePassword: true,
      createdAt: true,
      preferences: true,
    },
  })

  if (!user) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ user })
})

userRoutes.put('/me', zValidator('json', updateProfileSchema), async (c) => {
  const { userId } = c.get('user')
  const data = c.req.valid('json')

  const updates: Record<string, unknown> = { ...data }
  if (data.name) {
    updates.initials = data.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { id: true, email: true, name: true, initials: true, color: true, avatarUrl: true },
  })

  return c.json({ user })
})

userRoutes.post('/me/avatar', async (c) => {
  const { userId } = c.get('user')
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Se requiere un archivo de imagen' }, 400)
  }
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Solo se permiten imágenes (jpg, png, webp)' }, 400)
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'La imagen no puede superar 5 MB' }, 400)
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${userId}-${Date.now()}.${ext}`
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars')

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

  const avatarUrl = `/uploads/avatars/${filename}`

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: { id: true, email: true, name: true, initials: true, color: true, avatarUrl: true },
  })

  return c.json({ user })
})

const forceChangePasswordSchema = z.object({
  newPassword: z.string().min(8),
})

userRoutes.put('/me/force-change-password', zValidator('json', forceChangePasswordSchema), async (c) => {
  const { userId } = c.get('user')
  const { newPassword } = c.req.valid('json')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  })

  return c.json({ message: 'Contraseña actualizada.' })
})

userRoutes.put('/me/password', zValidator('json', changePasswordSchema), async (c) => {
  const { userId } = c.get('user')
  const { currentPassword, newPassword } = c.req.valid('json')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return c.json({ error: 'Usuario no encontrado' }, 404)

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return c.json({ error: 'Contraseña actual incorrecta' }, 400)

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

  await prisma.refreshToken.deleteMany({ where: { userId } })

  return c.json({ message: 'Contraseña actualizada. Volvé a iniciar sesión.' })
})

userRoutes.get('/me/preferences', async (c) => {
  const { userId } = c.get('user')

  const prefs = await prisma.userPreference.findUnique({ where: { userId } })
  return c.json({ preferences: prefs })
})

userRoutes.put('/me/preferences', zValidator('json', updatePreferencesSchema), async (c) => {
  const { userId } = c.get('user')
  const data = c.req.valid('json')

  const preferences = await prisma.userPreference.upsert({
    where: { userId },
    update: { ...data, updatedAt: new Date() },
    create: { userId, ...data, updatedAt: new Date() },
  })

  return c.json({ preferences })
})
