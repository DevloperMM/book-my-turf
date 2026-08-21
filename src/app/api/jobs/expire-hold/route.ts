import { NextRequest } from 'next/server'
import { okResponse, failResponse } from '@/lib/response'
import { logger } from '@/lib/logger'
import prisma from '@/lib/prisma'
import { qstashReceiver } from '@/lib/qstash'
import { publishSlotUpdate, publishBookingUpdate } from '@/lib/redis'
import { ValidationError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') || req.headers.get('Upstash-Signature')

  if (process.env.NODE_ENV === 'production') {
    if (!signature) {
      return failResponse(new ValidationError('Missing QStash signature'))
    }
    try {
      await qstashReceiver.verify({ body, signature })
    } catch (err) {
      logger.error({ err }, 'QStash signature verification failed')
      return failResponse(new ValidationError('Invalid signature'))
    }
  }

  let payload: { bookingId: string }
  try {
    payload = JSON.parse(body)
  } catch {
    return failResponse(new ValidationError('Invalid JSON'))
  }

  const { bookingId } = payload

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true }
    })

    if (!booking) {
      logger.warn({ bookingId }, 'Booking not found !!')
      return okResponse({ processed: true })
    }

    if (booking.status !== 'HELD') {
      logger.info(
        { bookingId, status: booking.status },
        'Booking not in HELD status, skipping expire'
      )
      return okResponse({ processed: true })
    }

    const now = new Date()
    if (booking.holdExpiresAt > now) {
      logger.info(
        { bookingId, holdExpiresAt: booking.holdExpiresAt },
        'Hold has not expired yet, skipping expire'
      )

      return okResponse({ processed: true, skipped: 'HOLD_NOT_EXPIRED' })
    }

    if (booking.payment && booking.payment.status === 'SUCCEEDED') {
      logger.info(
        { bookingId, paymentStatus: booking.payment.status },
        'Booking has succeeded payment, skipping expire'
      )
      return okResponse({ processed: true, skipped: 'PAYMENT_SUCCEEDED' })
    }

    await prisma.booking.update({
      where: { id: bookingId, status: 'HELD' },
      data: { status: 'EXPIRED' }
    })

    const dateStr = booking.date.toISOString().split('T')[0]
    await publishSlotUpdate(booking.turfId, booking.startTime.toISOString(), 'available', dateStr)
    await publishBookingUpdate(booking.id, { status: 'EXPIRED' })

    logger.info({ bookingId }, 'Hold expired')
    return okResponse({ processed: true })
  } catch (err) {
    logger.error({ err, bookingId }, 'Error processing expire-hold job')
    return failResponse(err)
  }
}
