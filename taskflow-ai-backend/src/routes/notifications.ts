import { Hono } from 'hono'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const notificationRoutes = new Hono<AppEnv>()

notificationRoutes.use('*', authMiddleware)

notificationRoutes.get('/', async (c) => {
  const { userId } = c.get('user')

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    take: 40,
  })

  return c.json({ notifications })
})

notificationRoutes.put('/read-all', async (c) => {
  const { userId } = c.get('user')
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  return c.json({ message: 'Todas marcadas como leídas' })
})

notificationRoutes.put('/:id/read', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== userId) return c.json({ error: 'No encontrada' }, 404)

  const notification = await prisma.notification.update({ where: { id }, data: { read: true } })
  return c.json({ notification })
})

notificationRoutes.delete('/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== userId) return c.json({ error: 'No encontrada' }, 404)

  await prisma.notification.delete({ where: { id } })
  return c.json({ message: 'Eliminada' })
})
