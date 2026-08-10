import prisma from '@/lib/prisma'
import { initiatePaymentSchema } from '@/lib/schemas'
import {
  ConflictError,
  NotFoundError,
  PaymentError,
  UnauthorizedError,
  fromZodError
} from '@/lib/errors'
import { razorpay } from '@/lib/razorpay'
import { isUniqueConstraintViolation } from '@/lib/utils'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'

export async function initiatePayment(userId: string, rawInput: unknown) {
  const parsed = initiatePaymentSchema.safeParse(rawInput)
  if (!parsed.success) throw fromZodError(parsed.error)

  const { bookingId, idempotencyKey } = parsed.data

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { turf: true }
  })

  if (!booking) throw new NotFoundError('Booking not found')

  if (booking.userId !== userId) throw new UnauthorizedError()

  if (booking.status !== 'HELD')
    throw new ConflictError('Booking is no longer held — it may have expired')

  if (booking.holdExpiresAt.getTime() <= Date.now())
    throw new ConflictError('Hold expired — please rebook')

  // Retry of the SAME payment attempt.
  const existingByKey = await prisma.payment.findUnique({ where: { idempotencyKey } })
  if (existingByKey) {
    return {
      gatewayOrderId: existingByKey.gatewayOrderId,
      amount: existingByKey.amount,
      keyId: env.RAZORPAY_KEY_ID
    }
  }

  // A payment already exists for this booking under a different key.
  const existingForBooking = await prisma.payment.findUnique({ where: { bookingId: booking.id } })
  if (existingForBooking) {
    return {
      gatewayOrderId: existingForBooking.gatewayOrderId,
      amount: existingForBooking.amount,
      keyId: env.RAZORPAY_KEY_ID
    }
  }

  const amount = booking.turf.pricePerHr
  const amountInPaise = Math.round(booking.turf.pricePerHr * 100)

  let order
  try {
    order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: idempotencyKey
    })
  } catch (gatewayErr) {
    logger.error({ err: gatewayErr, bookingId }, 'razorpay order creation failed')
    throw new PaymentError('Could not start payment — please try again')
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        gatewayOrderId: order.id,
        amount: amountInPaise,
        idempotencyKey,
        status: 'PENDING'
      }
    })

    return {
      gatewayOrderId: payment.gatewayOrderId,
      amount: payment.amount,
      keyId: env.RAZORPAY_KEY_ID
    }
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      logger.warn({ err }, 'unique constraint hit on payment create')
      const raced =
        (await prisma.payment.findUnique({ where: { idempotencyKey } })) ??
        (await prisma.payment.findUnique({ where: { bookingId: booking.id } }))
      if (raced) {
        return {
          gatewayOrderId: raced.gatewayOrderId,
          amount: raced.amount,
          keyId: env.RAZORPAY_KEY_ID
        }
      }
      throw new ConflictError('Payment already being processed — refresh and try again')
    }
    throw err
  }
}
