import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is required')

export const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
})
