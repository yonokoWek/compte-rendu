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
    console.warn('[DB] WARNING: DATABASE_URL is not set. All database operations will fail gracefully.')
  }
  return new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
