import { createMiddleware } from 'hono/factory'
import { verifyAccessToken } from '../lib/jwt.js'
import type { AppEnv } from '../lib/types.js'

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Token inválido o expirado' }, 401)
  }
})
