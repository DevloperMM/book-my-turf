import { Queue } from 'bullmq'
import redis from './redis'

export const holdExpiryQueue = new Queue('hold-expiry', { connection: redis })
export const confirmationQueue = new Queue('booking-confirmation', { connection: redis })
