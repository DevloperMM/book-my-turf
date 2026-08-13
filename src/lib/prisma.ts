import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma-client'
import { env } from '@/config/env'

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
