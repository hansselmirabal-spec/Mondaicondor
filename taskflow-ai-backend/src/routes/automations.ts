import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../lib/types.js'

export const automationRoutes = new Hono<AppEnv>()

automationRoutes.use('*', authMiddleware)

const automationSchema = z.object({
  name: z.string().min(1),
  triggerEvent: z.string().min(1),
  actionType: z.string().min(1),
  config: z.record(z.string(), z.any()).optional().default({}),
  enabled: z.boolean().optional().default(true),
})

async function assertBoardAccess(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } })
  if (!board) return null
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
  })
  return membership ? board : null
}

// GET /api/boards/:boardId/automations
automationRoutes.get('/boards/:boardId/automations', async (c) => {
  const { userId } = c.get('user')
  const { boardId } = c.req.param()
  const board = await assertBoardAccess(boardId, userId)
  if (!board) return c.json({ error: 'Sin acceso' }, 403)

  const automations = await prisma.automation.findMany({
    where: { boardId },
    orderBy: { createdAt: 'asc' },
  })
  return c.json({ automations })
})

// POST /api/boards/:boardId/automations
automationRoutes.post('/boards/:boardId/automations', zValidator('json', automationSchema), async (c) => {
  const { userId } = c.get('user')
  const { boardId } = c.req.param()
  const board = await assertBoardAccess(boardId, userId)
  if (!board) return c.json({ error: 'Sin acceso' }, 403)

  const data = c.req.valid('json')
  const automation = await prisma.automation.create({
    data: {
      boardId,
      name: data.name,
      triggerEvent: data.triggerEvent,
      actionType: data.actionType,
      config: data.config,
      enabled: data.enabled,
    },
  })
  return c.json({ automation }, 201)
})

// PUT /api/automations/:id
automationRoutes.put('/automations/:id', zValidator('json', automationSchema.partial()), async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const existing = await prisma.automation.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Automatización no encontrada' }, 404)
  const board = await assertBoardAccess(existing.boardId, userId)
  if (!board) return c.json({ error: 'Sin acceso' }, 403)

  const automation = await prisma.automation.update({ where: { id }, data: c.req.valid('json') })
  return c.json({ automation })
})

// DELETE /api/automations/:id
automationRoutes.delete('/automations/:id', async (c) => {
  const { userId } = c.get('user')
  const { id } = c.req.param()

  const existing = await prisma.automation.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Automatización no encontrada' }, 404)
  const board = await assertBoardAccess(existing.boardId, userId)
  if (!board) return c.json({ error: 'Sin acceso' }, 403)

  await prisma.automation.delete({ where: { id } })
  return c.json({ message: 'Eliminada' })
})
