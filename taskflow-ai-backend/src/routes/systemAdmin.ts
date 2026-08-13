import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const systemAdminRoutes = new Hono<AppEnv>()

systemAdminRoutes.use('*', authMiddleware)

// Guard: solo app admins
async function assertAppAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } })
  return user?.isAppAdmin === true
}

// GET /system-admin/users — listar todos los usuarios de la app
systemAdminRoutes.get('/users', async (c) => {
  const { userId } = c.get('user')
  if (!await assertAppAdmin(userId)) return c.json({ error: 'Sin acceso' }, 403)

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, initials: true, color: true, isAppAdmin: true, mustChangePassword: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return c.json({ users })
})

// POST /system-admin/users — crear usuario
const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
})

systemAdminRoutes.post('/users', zValidator('json', createSchema), async (c) => {
  const { userId } = c.get('user')
  if (!await assertAppAdmin(userId)) return c.json({ error: 'Sin acceso' }, 403)

  const { email, name, password } = c.req.valid('json')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return c.json({ error: 'El email ya está registrado' }, 409)

  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
  const colors = ['#e2445c', '#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#00c2cd']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { email, name, initials, color, passwordHash, mustChangePassword: true },
    select: { id: true, name: true, email: true, initials: true, color: true, isAppAdmin: true, mustChangePassword: true, createdAt: true },
  })
  return c.json({ user }, 201)
})

// PUT /system-admin/users/:id — editar usuario
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
})

systemAdminRoutes.put('/users/:id', zValidator('json', updateSchema), async (c) => {
  const { userId } = c.get('user')
  if (!await assertAppAdmin(userId)) return c.json({ error: 'Sin acceso' }, 403)

  const { id } = c.req.param()
  const { name, email } = c.req.valid('json')

  const data: Record<string, unknown> = {}
  if (name) {
    data.name = name
    data.initials = name.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
  }
  if (email) data.email = email

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, initials: true, color: true, isAppAdmin: true, mustChangePassword: true, createdAt: true },
    })
    return c.json({ user })
  } catch (err: any) {
    if (err?.code === 'P2025') return c.json({ error: 'Usuario no encontrado' }, 404)
    if (err?.code === 'P2002') return c.json({ error: 'El email ya está en uso' }, 409)
    throw err
  }
})

// POST /system-admin/users/:id/reset-password — resetear contraseña
systemAdminRoutes.post('/users/:id/reset-password', async (c) => {
  const { userId } = c.get('user')
  if (!await assertAppAdmin(userId)) return c.json({ error: 'Sin acceso' }, 403)

  const { id } = c.req.param()
  const tempPassword = randomBytes(6).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: id } }),
    ])
    return c.json({ tempPassword })
  } catch (err: any) {
    if (err?.code === 'P2025') return c.json({ error: 'Usuario no encontrado' }, 404)
    throw err
  }
})

// DELETE /system-admin/users/:id — eliminar usuario
systemAdminRoutes.delete('/users/:id', async (c) => {
  const { userId } = c.get('user')
  if (!await assertAppAdmin(userId)) return c.json({ error: 'Sin acceso' }, 403)

  const { id } = c.req.param()
  if (id === userId) return c.json({ error: 'No podés eliminarte a vos mismo' }, 400)

  try {
    await prisma.user.delete({ where: { id } })
    return c.json({ message: 'Usuario eliminado' })
  } catch (err: any) {
    if (err?.code === 'P2025') return c.json({ error: 'Usuario no encontrado' }, 404)
    throw err
  }
})
