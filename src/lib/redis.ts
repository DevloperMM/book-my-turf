import { env } from '@/config/env'
import { Redis } from 'ioredis'
import { logger } from '@/lib/logger'
import { SlotStatus } from '@/types'

let redis: Redis | null = null

export function getRedisConnection(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    })
  }
  return redis
}

export function createSubscriberConnection(): Redis {
  return getRedisConnection().duplicate()
}

export async function publishSlotUpdate(
  turfId: string,
  startTime: string,
  status: SlotStatus,
  date?: string
): Promise<void> {
  const client = getRedisConnection()
  const channel = `turf:${turfId}:slots`

  await client.publish(channel, JSON.stringify({ turfId, startTime, status }))

  if (date) {
    await client.del(`cache:turf:${turfId}:slots:${date}`)
  }

  logger.debug({ turfId, startTime, status }, 'Slot update published')
}

export async function publishBookingUpdate(
  bookingId: string,
  data: { status: string; paymentStatus?: string }
): Promise<void> {
  const client = getRedisConnection()
  const channel = `booking:${bookingId}:status`

  await client.publish(channel, JSON.stringify(data))

  logger.debug({ bookingId, ...data }, 'Booking update published')
}
