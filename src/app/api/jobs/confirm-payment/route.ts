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
      return failResponse(new ValidationError('Invalid signature') as never)
    }
  }

  let payload: { bookingId: string; paymentId: string; gatewayPaymentId: string }
  try {
    payload = JSON.parse(body)
  } catch {
    return failResponse(new ValidationError('Invalid JSON'))
  }

  const { bookingId, paymentId, gatewayPaymentId } = payload

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } })
      if (!payment || payment.status !== 'PENDING') {
        logger.info({ paymentId }, 'Payment already processed or not found')
        return null
      }

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { gatewayPaymentId, status: 'SUCCEEDED' }
      })

      const booking = await tx.booking.update({
        where: { id: bookingId, status: 'HELD' },
        data: { status: 'CONFIRMED' }
      })

      return { payment: updatedPayment, booking }
    })

    if (result) {
      const dateStr = result.booking.date.toISOString().split('T')[0]
      await publishSlotUpdate(
        result.booking.turfId,
        result.booking.startTime.toISOString(),
        'booked',
        dateStr
      )
      await publishBookingUpdate(result.booking.id, {
        status: 'CONFIRMED',
        paymentStatus: 'SUCCEEDED'
      })

      logger.info({ bookingId, paymentId }, 'Payment confirmed and booking confirmed')
    }

    return okResponse({ processed: true })
  } catch (err) {
    logger.error({ err, bookingId, paymentId }, 'Error processing confirm-payment job')
    return failResponse(err as never)
  }
}
