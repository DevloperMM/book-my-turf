import prisma from './prisma'
import { Slot, Turf } from '@/types'
import crypto from 'crypto'
import { env } from '@/config/env'

export async function computeSlotsForDate(turf: Turf, dateKey: string): Promise<Slot[]> {
  const date = new Date(`${dateKey}T00:00:00.000Z`)

  const activeBookings = await prisma.booking.findMany({
    where: {
      turfId: turf.id,
      date,
      OR: [
        { status: { in: ['PAID', 'CONFIRMED'] } },
        { status: 'HELD', holdExpiresAt: { gt: new Date() } }
      ]
    },
    select: { startTime: true }
  })
  const takenStarts = new Set(activeBookings.map((b) => new Date(b.startTime).getTime()))

  const slots: Slot[] = []
  const slotMs = turf.slotMinutes * 60_000
  let cursor = new Date(date)
  cursor.setUTCHours(turf.openHour, 0, 0, 0)
  const closeAt = new Date(date)
  closeAt.setUTCHours(turf.closeHour, 0, 0, 0)

  while (cursor < closeAt) {
    const startTimeMs = cursor.getTime()
    const endMs = startTimeMs + slotMs

    slots.push({
      startTime: cursor.toISOString(),
      endTime: endMs.toString(),
      status: takenStarts.has(startTimeMs) ? 'BOOKED' : 'AVAILABLE'
    })

    cursor = new Date(endMs)
  }

  return slots
}

export function isUniqueConstraintViolation(err: unknown, field?: string): boolean {
  if (typeof err !== 'object' || err === null) return false
  const code = (err as { code?: string }).code
  if (code !== 'P2002') return false
  if (!field) return true
  const target = (err as { meta?: { target?: string[] } }).meta?.target ?? []
  return target.includes(field)
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !env.RAZORPAY_WEBHOOK_SECRET) return false

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}
