import { NextRequest } from 'next/server'
import { okResponse, failResponse } from '@/lib/response'
import { toAppError, ValidationError } from '@/lib/errors'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { razorpayWebhookSchema } from '@/lib/schemas'
import prisma from '@/lib/prisma'
import Razorpay from 'razorpay'
import { qstashClient } from '@/lib/qstash'
import { publishSlotUpdate, publishBookingUpdate } from '@/lib/redis'
import { BookingStatus, Prisma } from '@prisma-client'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature')
  const secret = env.RAZORPAY_WEBHOOK_SECRET

  if (!signature) {
    return failResponse(new ValidationError('Missing Razorpay signature'))
  }

  if (!Razorpay.validateWebhookSignature(body, signature, secret)) {
    logger.error('Razorpay webhook signature mismatch')
    return failResponse(new ValidationError('Invalid webhook signature'))
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return failResponse(new ValidationError('Unable to parse JSON'))
  }

  const result = razorpayWebhookSchema.safeParse(parsed)
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, 'Zod validation failed on razorpay webhook')
    return failResponse(new ValidationError('Invalid webhook payload'))
  }

  const schema = result.data
  const eventId = req.headers.get('x-razorpay-event-id')

  if (eventId) {
    try {
      const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } })
      if (existing) {
        logger.info({ eventId }, 'Duplicate webhook event! Payment already processed')
        return okResponse({ processed: true, duplicate: true })
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.info({ eventId }, 'Duplicate webhook event received; returning 200')
        return okResponse({ processed: true, duplicate: true })
      }
      logger.warn({ err, eventId }, 'Failed to record WebhookEvent')
    }
  }

  try {
    if (schema.event === 'payment.captured') {
      const paymentEntity = schema.payload?.payment?.entity
      if (!paymentEntity) {
        return failResponse(new ValidationError('Missing payment entity'))
      }

      const payment = await prisma.payment.findUnique({
        where: { gatewayOrderId: paymentEntity.order_id }
      })

      if (!payment) {
        logger.error({ orderId: paymentEntity.order_id }, 'Payment not found for order')
        return failResponse(new ValidationError('Payment not found for this order'))
      }

      await qstashClient.publishJSON({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/confirm-payment`,
        body: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          gatewayPaymentId: paymentEntity.id,
          amount: paymentEntity.amount
        }
      })

      if (eventId) {
        await prisma.webhookEvent
          .create({
            data: { id: eventId, type: schema.event }
          })
          .catch((err) => {
            logger.warn({ err, eventId }, 'Failed to insert WebhookEvent record')
          })
      }

      logger.info(
        { eventId, eventType: schema.event, bookingId: payment.bookingId },
        'Razorpay payment.captured enqueued to QStash'
      )

      return okResponse({ processed: true })
    }

    if (schema.event === 'payment.failed') {
      const paymentEntity = schema.payload?.payment?.entity
      if (paymentEntity) {
        const payment = await prisma.payment.findUnique({
          where: { gatewayOrderId: paymentEntity.order_id }
        })
        if (payment && payment.status !== 'FAILED') {
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED' }
            })

            await tx.booking.update({
              where: { id: payment.bookingId },
              data: { status: BookingStatus.CANCELLED }
            })
          })

          const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } })
          if (booking) {
            const dateStr = booking.date.toISOString().split('T')[0]
            await publishSlotUpdate(
              booking.turfId,
              booking.startTime.toISOString(),
              'available',
              dateStr
            )
            await publishBookingUpdate(booking.id, { status: 'CANCELLED', paymentStatus: 'FAILED' })
          }
        }
      }
      if (eventId) {
        await prisma.webhookEvent
          .create({
            data: { id: eventId, type: schema.event }
          })
          .catch((err) => {
            logger.warn({ err, eventId }, 'Failed to insert WebhookEvent record')
          })
      }
      logger.warn({ eventId }, 'Razorpay payment.failed processed')
      return okResponse({ processed: true })
    }

    logger.info({ eventType: schema.event }, 'Unhandled Razorpay event type')
    return okResponse({ processed: false, reason: 'unhandled_event' })
  } catch (err) {
    logger.error({ err, eventId }, 'Error processing Razorpay webhook')
    return failResponse(toAppError(err))
  }
}
