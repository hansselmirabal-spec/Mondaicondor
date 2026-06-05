import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'

export const authRoutes = new Hono()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return c.json({ error: 'El email ya está registrado' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
  const color = colors[Math.floor(Math.random() * colors.length)]

  const user = await prisma.user.create({
    data: { email, name, initials, color, passwordHash },
    select: { id: true, email: true, name: true, initials: true, color: true },
  })

  const accessToken = signAccessToken({ userId: user.id, email: user.email })
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return c.json({ user, accessToken, refreshToken }, 201)
})

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email })
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const { passwordHash: _, ...safeUser } = user
  return c.json({ user: safeUser, accessToken, refreshToken })
})

authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null)
  const token: string | undefined = body?.refreshToken

  if (!token) return c.json({ error: 'Refresh token requerido' }, 400)

  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  if (!stored || stored.expiresAt < new Date()) {
    return c.json({ error: 'Refresh token inválido o expirado' }, 401)
  }

  try {
    const payload = verifyRefreshToken(token)

    const newRefreshToken = signRefreshToken({ userId: payload.userId, email: payload.email })
    const newAccessToken = signAccessToken({ userId: payload.userId, email: payload.email })

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token } }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: payload.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ])

    return c.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch {
    return c.json({ error: 'Token inválido' }, 401)
  }
})

authRoutes.post('/logout', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null)
  const token: string | undefined = body?.refreshToken

  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } })
  }

  return c.json({ message: 'Sesión cerrada' })
})
