'use server'

import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { initiatePaymentSchema, verifyPaymentSchema } from '@/lib/schemas'
import { razorpay } from '@/lib/razorpay'
import { logger } from '@/lib/logger'
import { type InitiatePaymentInput, type InitiatePaymentResult } from '@/types'
import Razorpay from 'razorpay'
import { BookingStatus, PaymentStatus } from '@prisma-client'

const PAYMENT_HOLD_EXTEND_MS = 5 * 60 * 1000

export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()

  const parsed = initiatePaymentSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Invalid input')

  const { bookingId } = parsed.data

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { turf: true, payment: true }
  })

  if (!booking) return { ok: false, reason: 'BOOKING_NOT_FOUND' }
  if (booking.status !== BookingStatus.HELD) {
    return { ok: false, reason: 'BOOKING_NOT_HELD' }
  }

  const existingPayment = booking.payment
  if (existingPayment && existingPayment.gatewayOrderId) {
    logger.info(
      { bookingId, orderId: existingPayment.gatewayOrderId },
      'Returning existing payment order (idempotent)'
    )
    return {
      ok: true,
      orderId: existingPayment.gatewayOrderId,
      amount: existingPayment.amount,
      keyId: process.env.RAZORPAY_KEY_ID!
    }
  }

  const idempotencyKey = `pay_${bookingId}`

  const order = await razorpay.orders.create({
    amount: booking.turf.pricePerHr * 100,
    currency: 'INR',
    receipt: bookingId,
    notes: { bookingId },
    payment_capture: true
  })

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      gatewayOrderId: order.id,
      amount: booking.turf.pricePerHr,
      status: PaymentStatus.PENDING,
      idempotencyKey
    },
    update: {
      gatewayOrderId: order.id,
      idempotencyKey
    }
  })

  await prisma.booking.update({
    where: { id: bookingId },
    data: { holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_EXTEND_MS) }
  })

  logger.info({ bookingId, paymentId: payment.id, orderId: order.id }, 'Payment initiated')

  return {
    ok: true,
    orderId: order.id,
    amount: booking.turf.pricePerHr,
    keyId: process.env.RAZORPAY_KEY_ID!
  }
}

export async function confirmPayment(payload: {
  id: string
  order_id: string
  amount: number
  status: string
}) {
  const { id: gatewayPaymentId, order_id: gatewayOrderId, status: gatewayStatus } = payload

  if (gatewayStatus !== 'captured') {
    logger.warn({ gatewayPaymentId, gatewayStatus }, 'Payment not captured')
    return null
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { gatewayPaymentId }
  })
  if (existingPayment) {
    logger.info({ gatewayPaymentId }, 'Payment already processed (idempotent)')
    return existingPayment
  }

  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId }
  })
  if (!payment) {
    logger.error({ gatewayOrderId }, 'Payment not found for order')
    throw new NotFoundError('Payment not found for this order')
  }

  if (payment.status === PaymentStatus.SUCCEEDED) {
    logger.info({ paymentId: payment.id }, 'Payment already succeeded (idempotent)')
    return payment
  }

  const [updatedPayment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayPaymentId,
        status: PaymentStatus.SUCCEEDED
      }
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.CONFIRMED }
    })
  ])

  logger.info({ paymentId: payment.id, bookingId: payment.bookingId }, 'Payment confirmed')

  return updatedPayment
}

export async function verifyPayment(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { payment: true }
  })

  if (!booking) throw new NotFoundError('Booking not found')

  return {
    bookingId: booking.id,
    status: booking.status,
    payment: booking.payment
      ? {
          id: booking.payment.id,
          amount: booking.payment.amount,
          status: booking.payment.status,
          createdAt: booking.payment.createdAt
        }
      : null
  }
}

export async function verifyPaymentSignature(input: {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = verifyPaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Unauthenticated' }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = parsed.data

  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = Razorpay.validateWebhookSignature(
    body,
    razorpay_signature,
    process.env.RAZORPAY_KEY_SECRET!
  )

  if (!expectedSignature) {
    logger.warn({ razorpay_order_id, razorpay_payment_id }, 'Payment signature verification failed')
    return { ok: false, error: 'Invalid payment signature' }
  }

  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: razorpay_order_id },
    include: { booking: true }
  })

  if (!payment || payment.booking.userId !== userId) {
    return { ok: false, error: 'Payment not found' }
  }

  logger.info({ bookingId: payment.bookingId, paymentId: payment.id }, 'Payment signature verified')
  return { ok: true }
}
