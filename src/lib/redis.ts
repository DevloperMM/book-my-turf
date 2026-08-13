import { env } from '@/config/env'
import { Redis } from 'ioredis'

let _conn: Redis | null = null

export function getRedisConnection(): Redis {
  if (!_conn) {
    _conn = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      tls: {}
    })
  }

  return _conn
}

export function createSubscriberConnection(): Redis {
  return getRedisConnection().duplicate()
}
