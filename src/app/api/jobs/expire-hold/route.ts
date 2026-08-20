import { NextRequest } from 'next/server'
import { okResponse, failResponse } from '@/lib/response'
import { logger } from '@/lib/logger'
import prisma from '@/lib/prisma'
import { qstashReceiver } from '@/lib/qstash'
import { publishSlotUpdate } from '@/lib/redis'
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
      where: { id: bookingId }
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

    await prisma.booking.update({
      where: { id: bookingId, status: 'HELD' },
      data: { status: 'EXPIRED' }
    })

    const dateStr = booking.date.toISOString().split('T')[0]
    await publishSlotUpdate(booking.turfId, booking.startTime.toISOString(), 'available', dateStr)

    logger.info({ bookingId }, 'Hold expired')
    return okResponse({ processed: true })
  } catch (err) {
    logger.error({ err, bookingId }, 'Error processing expire-hold job')
    return failResponse(err)
  }
}
