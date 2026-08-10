import prisma from '@/lib/prisma'
import { createHoldSchema } from '@/lib/schemas'
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  fromZodError
} from '@/lib/errors'
import { holdExpiryQueue } from '@/lib/queues'
import { isUniqueConstraintViolation } from '@/lib/utils'
import { logger } from '@/lib/logger'

const HOLD_MINUTES = 8

const BOOKING_SELECT = {
  id: true,
  turfId: true,
  userId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  holdExpiresAt: true,
  idempotencyKey: true,
  turf: {
    select: {
      id: true,
      name: true,
      location: true,
      pricePerHr: true,
      openHour: true,
      closeHour: true,
      slotMinutes: true,
      imageUrl: true
    }
  },
  payment: {
    select: { id: true, status: true, gatewayOrderId: true, amount: true }
  }
} as const

export async function holdSlot(userId: string, rawInput: unknown) {
  const parsed = createHoldSchema.safeParse(rawInput)
  if (!parsed.success) throw fromZodError(parsed.error)
  const { turfId, date, startTime, endTime, idempotencyKey } = parsed.data

  // Retry of the SAME hold attempt — return the existing row instead of
  // trying (and failing) to insert again.
  const existing = await prisma.booking.findUnique({
    where: { idempotencyKey },
    select: BOOKING_SELECT
  })
  if (existing) {
    if (existing.userId !== userId)
      throw new ConflictError('This hold belongs to a different session')
    return existing
  }

  const turf = await prisma.turf.findUnique({ where: { id: turfId } })
  if (!turf) throw new NotFoundError('Turf not found')

  const start = new Date(startTime)
  const end = new Date(endTime)
  if (start.getTime() <= Date.now()) throw new ValidationError('Cannot book a slot in the past')
  if (end.getTime() <= start.getTime()) throw new ValidationError('endTime must be after startTime')

  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000)

  try {
    // This insert IS the lock — the composite unique constraint on
    // (turfId, date, startTime) rejects a second concurrent hold for the
    // same slot with a P2002 error, handled below.
    const booking = await prisma.booking.create({
      data: {
        turfId,
        userId,
        date: new Date(`${date}T00:00:00.000Z`),
        startTime: start,
        endTime: end,
        holdExpiresAt,
        idempotencyKey,
        status: 'HELD'
      },
      select: BOOKING_SELECT
    })

    await holdExpiryQueue.add(
      'expire-hold',
      { bookingId: booking.id },
      { delay: HOLD_MINUTES * 60_000, jobId: booking.id }
    )

    return booking
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      logger.warn({ err }, 'unique constraint hit on booking create')

      // Two requests carrying the SAME idempotencyKey landed concurrently —
      // this is the caller's own retry racing itself, not a real conflict.
      if (isUniqueConstraintViolation(err, 'idempotencyKey')) {
        const raced = await prisma.booking.findUnique({
          where: { idempotencyKey },
          select: BOOKING_SELECT
        })
        if (raced) return raced
      }

      // Otherwise: someone else genuinely holds this exact slot.
      throw new ConflictError()
    }
    throw err
  }
}

export async function getBooking(userId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT
  })
  if (!booking) throw new NotFoundError('Booking not found')
  if (booking.userId !== userId) throw new UnauthorizedError()
  return booking
}

export async function listMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    select: BOOKING_SELECT,
    orderBy: { startTime: 'desc' }
  })
}
