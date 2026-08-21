'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { holdSlotSchema, cancelBookingSchema } from '@/lib/schemas'
import {
  type HoldSlotInput,
  type CancelBookingInput,
  type HoldSlotResult,
  type CancelBookingResult
} from '@/types'
import { BookingStatus } from '@prisma-client'
import { publishSlotUpdate } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { qstashClient } from '@/lib/qstash'
import { env } from '@/config/env'
import { getISTHourFromUTC, getCurrentISTDate } from '@/lib/timezone'
import crypto from 'crypto'
import { HOLD_TTL_MINUTES } from '@/lib/constants'

export async function createHold(input: HoldSlotInput): Promise<HoldSlotResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, reason: 'UNAUTHENTICATED' }

  const parsed = holdSlotSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError('Invalid input')
  }

  const { turfId, startTime } = parsed.data

  const turf = await prisma.turf.findUnique({ where: { id: turfId } })
  if (!turf) throw new NotFoundError('Turf not found')

  const slotDate = new Date(startTime)
  const istHour = getISTHourFromUTC(slotDate)
  const endTime = new Date(slotDate.getTime() + turf.slotMinutes * 60 * 1000)

  const isMidnightWrap = turf.closeHour <= turf.openHour
  const isValidHour = isMidnightWrap
    ? istHour >= turf.openHour
    : istHour >= turf.openHour && istHour < turf.closeHour

  if (!isValidHour) {
    throw new ValidationError('Slot is outside turf operating hours')
  }

  const istDateStr = getCurrentISTDate()
  const dateOnly = new Date(istDateStr + 'T00:00:00.000Z')
  const idempotencyKey = crypto.randomUUID()
  const dateStr = istDateStr

  try {
    const booking = await prisma.booking.create({
      data: {
        turfId,
        userId,
        date: dateOnly,
        startTime: slotDate,
        endTime,
        status: BookingStatus.HELD,
        holdExpiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000),
        idempotencyKey
      }
    })

    logger.info({ bookingId: booking.id, turfId, userId }, 'Hold created')

    await publishSlotUpdate(turfId, slotDate.toISOString(), 'held', dateStr)

    try {
      await qstashClient.publishJSON({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/expire-hold`,
        body: { bookingId: booking.id },
        delay: `${HOLD_TTL_MINUTES}m`
      })
      logger.info({ bookingId: booking.id }, 'QStash expire-hold enqueued')
    } catch (qErr) {
      logger.warn({ err: qErr, bookingId: booking.id }, 'QStash enqueue failed (expire-hold)')
    }

    return { ok: true, bookingId: booking.id }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      ((err as { code: string }).code === 'P2002' || (err as { code: string }).code === '23505')
    ) {
      return { ok: false, reason: 'SLOT_TAKEN' }
    }
    throw err
  }
}

export async function cancelBooking(input: CancelBookingInput): Promise<CancelBookingResult> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()

  const parsed = cancelBookingSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Invalid input')

  const { bookingId } = parsed.data

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId }
  })
  if (!booking) throw new NotFoundError('Booking not found')

  if (booking.status === BookingStatus.CANCELLED) {
    return { ok: true }
  }

  if (
    booking.status !== BookingStatus.HELD &&
    booking.status !== BookingStatus.PAID &&
    booking.status !== BookingStatus.CONFIRMED
  ) {
    return { ok: false, reason: 'INVALID_STATUS' }
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED }
  })

  const dateStr = updated.date.toISOString().split('T')[0]
  await publishSlotUpdate(booking.turfId, booking.startTime.toISOString(), 'available', dateStr)

  logger.info({ bookingId, userId }, 'Booking cancelled')
  return { ok: true }
}

export async function getBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      turf: { select: { name: true, location: true, pricePerHr: true } },
      payment: { select: { id: true, amount: true, status: true, createdAt: true } }
    }
  })

  if (!booking) throw new NotFoundError('Booking not found')
  return {
    ...booking,
    holdExpiresAt: booking.holdExpiresAt.toISOString()
  }
}

export async function listBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      turf: { select: { name: true, location: true, pricePerHr: true } },
      payment: { select: { amount: true, status: true } }
    }
  })
}
