import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { razorpayWebhookSchema } from '@/lib/schemas'
import { okResponse, failResponse } from '@/lib/response'
import { ValidationError, toAppError } from '@/lib/errors'
import { verifyWebhookSignature } from '@/lib/utils'
import { confirmationQueue, holdExpiryQueue } from '@/lib/queues'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma-client'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new ValidationError('Invalid webhook signature')
    }

    const json = JSON.parse(rawBody)
    const parsed = razorpayWebhookSchema.safeParse(json)
    if (!parsed.success) {
      // Unrecognized event shape — ack it so Razorpay stops retrying, but do nothing.
      return okResponse({ received: true, ignored: true })
    }

    const event = parsed.data

    // Safely extract payment entity
    const paymentEntity = event.payload?.payment?.entity
    if (!paymentEntity) {
      return okResponse({ received: true, ignored: true })
    }

    // Razorpay sends an event-id header on most deliveries; fall back to a composed key
    const eventId =
      req.headers.get('x-razorpay-event-id') ??
      `${event.event}:${paymentEntity.id}:${paymentEntity.status}`

    try {
      await prisma.webhookEvent.create({ data: { id: eventId, type: event.event } })
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.info({ eventId }, 'duplicate webhook delivery, ignoring')
        return okResponse({ received: true, duplicate: true })
      }
      throw err
    }

    const orderId = paymentEntity.order_id

    if (event.event === 'payment.captured' && orderId) {
      // updateMany + a status guard in `where` — if this payment isn't PENDING
      // anymore (already handled by an earlier delivery), this matches zero
      // rows and silently no-ops instead of double-processing.
      const updated = await prisma.payment.updateMany({
        where: { gatewayOrderId: orderId, status: 'PENDING' },
        data: { status: 'SUCCEEDED' }
      })

      if (updated.count > 0) {
        const payment = await prisma.payment.findUnique({ where: { gatewayOrderId: orderId } })
        if (payment) {
          await prisma.booking.updateMany({
            where: { id: payment.bookingId, status: 'HELD' },
            data: { status: 'PAID' }
          })
          await confirmationQueue.add('confirm-booking', { bookingId: payment.bookingId })

          // jobId was set to the booking id at hold-creation time — remove it
          // now rather than let it fire a no-op EXPIRED check 8 minutes later.
          await holdExpiryQueue.remove(payment.bookingId).catch(() => null)

          logger.info({ bookingId: payment.bookingId }, 'payment captured, confirmation queued')
        }
      }
    }

    if (event.event === 'payment.failed' && orderId) {
      await prisma.payment.updateMany({
        where: { gatewayOrderId: orderId, status: 'PENDING' },
        data: { status: 'FAILED' }
      })
    }

    return okResponse({ received: true })
  } catch (err) {
    return failResponse(toAppError(err))
  }
}
