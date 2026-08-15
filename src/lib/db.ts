import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('[DB] WARNING: DATABASE_URL is not set. Database operations will fail.')
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })

if (!globalForPrisma.prisma) globalForPrisma.prisma = db
