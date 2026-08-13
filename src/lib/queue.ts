import { Queue } from 'bullmq'
import { getRedisConnection } from './redis'

export const confirmBookingQueue = new Queue('confirmBooking', {
  connection: getRedisConnection()
})
