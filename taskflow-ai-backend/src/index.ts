import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { workspaceRoutes } from './routes/workspaces.js'
import { boardRoutes } from './routes/boards.js'
import { taskRoutes } from './routes/tasks.js'
import { adminRoutes } from './routes/admin.js'
import { automationRoutes } from './routes/automations.js'
import { notificationRoutes } from './routes/notifications.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  })
)

app.use('/uploads/*', serveStatic({ root: './public' }))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/api/auth', authRoutes)
app.route('/api/users', userRoutes)
app.route('/api/workspaces', workspaceRoutes)
app.route('/api/boards', boardRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/admin', adminRoutes)
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
