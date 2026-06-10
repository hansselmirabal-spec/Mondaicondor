import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Context, Next } from 'hono'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { workspaceRoutes } from './routes/workspaces.js'
import { boardRoutes } from './routes/boards.js'
import { taskRoutes } from './routes/tasks.js'
import { adminRoutes } from './routes/admin.js'
import { systemAdminRoutes } from './routes/systemAdmin.js'
import { automationRoutes } from './routes/automations.js'
import { notificationRoutes } from './routes/notifications.js'

// --- Rate limiter -----------------------------------------------------------
type RateLimitEntry = { count: number; resetAt: number }

function makeRateLimiter(max: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of store.entries()) {
      if (now > val.resetAt) store.delete(key)
    }
  }, 5 * 60 * 1000)

  return async function rateLimiter(c: Context, next: Next) {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (entry.count >= max) {
      return c.json({ error: 'Demasiados intentos. Intentá de nuevo en un momento.' }, 429)
    }
    entry.count++
    return next()
  }
}
// ---------------------------------------------------------------------------

const app = new Hono()

app.use('*', logger())

// Fix 1 — CORS from env
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.APP_URL ? [process.env.APP_URL] : []),
]
app.use('*', cors({ origin: allowedOrigins, credentials: true }))

app.use('/uploads/*', serveStatic({ root: './public' }))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Fix 2 — Rate limiting on auth routes
app.use('/api/auth/login', makeRateLimiter(10, 60_000))
app.use('/api/auth/forgot-password', makeRateLimiter(5, 60_000))
app.use('/api/auth/register', makeRateLimiter(5, 60_000))

app.route('/api/auth', authRoutes)
app.route('/api/users', userRoutes)
app.route('/api/workspaces', workspaceRoutes)
app.route('/api/boards', boardRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/system-admin', systemAdminRoutes)
app.route('/api', automationRoutes)
app.route('/api/notifications', notificationRoutes)

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Error interno del servidor' }, 500)
})

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, () => {
  console.log(`TaskFlow API corriendo en http://localhost:${port}`)
})
