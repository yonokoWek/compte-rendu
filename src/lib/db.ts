import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL

export function isDatabaseConfigured(): boolean {
  return !!databaseUrl
}

let prismaInstance: PrismaClient | undefined

function createPrismaClient(): PrismaClient {
  if (!databaseUrl) {
    // Return a dummy client that will fail gracefully on any operation
    console.error('[DB] WARNING: DATABASE_URL is not set. All database operations will return errors.')
  }
  return new PrismaClient({
    datasourceUrl: databaseUrl || 'postgresql://localhost:0/placeholder',
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
