import Redis from 'ioredis'
import { env } from '@/config/env'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

const redisUrl = env.REDIS_URL

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  })

if (env.NODE_ENV !== 'production') globalForRedis.redis = redis
