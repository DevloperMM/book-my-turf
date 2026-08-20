'use client'

import { useEffect, useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { getBooking, cancelBooking } from '@/actions/booking.action'
import { initiatePayment, verifyPaymentSignature } from '@/actions/payment.action'
import { toast } from 'sonner'
import { toISTDateString, toISTTimeRange } from '@/lib/timezone'
import { useBookingStream } from '@/hooks/useBookingStream'

interface Booking {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  holdExpiresAt: string
  createdAt: string
  turf: { name: string; location: string; pricePerHr: number }
  payment: { id: string; amount: number; status: string; createdAt: string } | null
}

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn, user } = useUser()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      router.push('/login')
      return
    }

    getBooking(params.id as string, user.id)
      .then((data) => {
        setBooking(data as unknown as Booking)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [isSignedIn, user?.id, params.id, router])

  useBookingStream(booking?.id || '', (update) => {
    setBooking((prev) => (prev ? { ...prev, ...update } : null))
  })

  useEffect(() => {
    if (!booking || booking.status !== 'HELD' || booking.payment) return

    const interval = setInterval(() => {
      const expires = new Date(booking.holdExpiresAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((expires - now) / 1000))
      setTimeLeft(diff)

      if (diff === 0) {
        clearInterval(interval)
        setBooking((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [booking])

  const handlePay = () => {
    if (!booking) return

    startTransition(async () => {
      try {
        const result = await initiatePayment({ bookingId: booking.id })
        if (!result.ok) {
          toast.error(result.reason)
          return
        }

        const options = {
          key: result.keyId,
          amount: result.amount * 100,
          currency: 'INR',
          name: 'BookMySlot',
          description: `Booking at ${booking.turf.name}`,
          order_id: result.orderId,
          handler: async (response: {
            razorpay_payment_id: string
            razorpay_order_id: string
            razorpay_signature: string
          }) => {
            const verification = await verifyPaymentSignature({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
            if (verification.ok) {
              toast.success('Payment verified! Confirming...')
            } else {
              toast.error('Payment verification failed. Please contact support.')
            }
          },
          modal: {
            ondismiss: async () => {
              toast.error('Payment cancelled')
              try {
                await cancelBooking({ bookingId: booking.id })
                setBooking((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null))
              } catch {
                // ignore — webhook will clean up if needed
              }
            }
          },
          prefill: {
            name: user?.fullName || '',
            email: user?.emailAddresses?.[0]?.emailAddress || ''
          },
          theme: {
            color: '#76b900'
          }
        }

        const rzp = new window.Razorpay(options)
        rzp.open()

        setBooking((prev) =>
          prev
            ? {
                ...prev,
                payment: {
                  id: '',
                  amount: result.amount,
                  status: 'PENDING',
                  createdAt: new Date().toISOString()
                },
                holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
              }
            : null
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Payment failed')
      }
    })
  }

  const handleCancel = () => {
    if (!booking) return

    startTransition(async () => {
      try {
        await cancelBooking({ bookingId: booking.id })
        setBooking((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null))
        toast.success('Booking cancelled')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel')
      }
    })
  }

  if (loading) {
    return (
      <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
        <div
          className="max-w-2xl mx-auto px-6"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <p style={{ color: 'var(--mute)' }}>Loading...</p>
        </div>
      </main>
    )
  }

  if (!booking) {
    return (
      <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
        <div
          className="max-w-2xl mx-auto px-6"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <p style={{ color: 'var(--mute)' }}>Booking not found</p>
        </div>
      </main>
    )
  }

  const date = new Date(booking.date)
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  const dateIST = toISTDateString(date)
  const timeRangeIST = toISTTimeRange(start, end)

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-2xl mx-auto px-6"
        style={{ paddingTop: '64px', paddingBottom: '64px' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4"
          style={{ marginBottom: '32px' }}
        >
          <div>
            <h1
              style={{
                fontWeight: 700,
                fontSize: '36px',
                lineHeight: 1.25,
                color: 'var(--ink)',
                marginBottom: '4px'
              }}
            >
              {booking.turf.name}
            </h1>
            <p style={{ color: 'var(--mute)', fontSize: '16px' }}>{booking.turf.location}</p>
          </div>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '2px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              backgroundColor:
                booking.status === 'CONFIRMED' ? 'var(--green)' : 'var(--surface-soft)',
              color: booking.status === 'CONFIRMED' ? '#000000' : 'var(--ink)'
            }}
          >
            {booking.status}
          </span>
        </div>

        {/* Booking details card */}
        <div
          className="nvidia-card"
          style={{ padding: '32px', marginBottom: '32px' }}
        >
          <div
            className="grid grid-cols-2 gap-4"
            style={{ fontSize: '15px' }}
          >
            <div>
              <p
                style={{
                  color: 'var(--mute)',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                Date
              </p>
              <p style={{ fontWeight: 700, color: 'var(--ink)' }}>{dateIST}</p>
            </div>
            <div>
              <p
                style={{
                  color: 'var(--mute)',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                Time
              </p>
              <p style={{ fontWeight: 700, color: 'var(--ink)' }}>{timeRangeIST}</p>
            </div>
            <div>
              <p
                style={{
                  color: 'var(--mute)',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                Amount
              </p>
              <p style={{ fontWeight: 700, color: 'var(--ink)' }}>₹{booking.turf.pricePerHr}</p>
            </div>
            {booking.payment && (
              <div>
                <p
                  style={{
                    color: 'var(--mute)',
                    marginBottom: '4px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  Payment
                </p>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '2px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor:
                      booking.payment.status === 'SUCCEEDED'
                        ? 'var(--green)'
                        : 'var(--surface-soft)',
                    color: booking.payment.status === 'SUCCEEDED' ? '#000000' : 'var(--ink)'
                  }}
                >
                  {booking.payment.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* HELD — no payment yet: countdown + Pay + Cancel */}
        {booking.status === 'HELD' && !booking.payment && (
          <div
            className="nvidia-card"
            style={{ padding: '32px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', color: 'var(--mute)', marginBottom: '8px' }}>
                Complete payment within{' '}
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    fontSize: '18px'
                  }}
                >
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </p>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: 'var(--surface-soft)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'var(--green)',
                    width: `${(timeLeft / 600) * 100}%`,
                    transition: 'width 1s linear'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handlePay}
                disabled={isPending || timeLeft === 0}
              >
                {isPending ? 'Processing...' : 'Pay Now'}
              </button>
              <button
                className="btn-outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* HELD — payment pending: no buttons */}
        {booking.status === 'HELD' && booking.payment?.status === 'PENDING' && (
          <div
            className="nvidia-card"
            style={{ padding: '32px', textAlign: 'center' }}
          >
            <p
              style={{
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: '8px',
                fontSize: '18px'
              }}
            >
              Payment processing
            </p>
            <p style={{ fontSize: '15px', color: 'var(--mute)' }}>
              Waiting for confirmation from payment provider.
            </p>
          </div>
        )}

        {/* HELD — payment failed: no buttons */}
        {booking.status === 'HELD' && booking.payment?.status === 'FAILED' && (
          <div
            className="nvidia-card"
            style={{ padding: '32px', textAlign: 'center' }}
          >
            <p
              style={{
                fontWeight: 700,
                color: 'var(--destructive)',
                marginBottom: '8px',
                fontSize: '18px'
              }}
            >
              Payment failed
            </p>
            <p style={{ fontSize: '15px', color: 'var(--mute)' }}>
              Booking ID: <span style={{ fontFamily: 'monospace' }}>{booking.id}</span>
            </p>
          </div>
        )}

        {/* Expired */}
        {booking.status === 'EXPIRED' && (
          <div
            className="nvidia-card"
            style={{ padding: '32px', textAlign: 'center' }}
          >
            <p
              style={{
                fontWeight: 700,
                color: 'var(--destructive)',
                marginBottom: '8px',
                fontSize: '18px'
              }}
            >
              Hold expired
            </p>
            <p style={{ fontSize: '15px', color: 'var(--mute)', marginBottom: '16px' }}>
              This slot is no longer held. You can book it again if available.
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push('/')}
            >
              Browse Turfs
            </button>
          </div>
        )}

        {/* Cancelled (no payment made) */}
        {booking.status === 'CANCELLED' && !booking.payment && (
          <div
            className="nvidia-card"
            style={{ padding: '32px', textAlign: 'center' }}
          >
            <p
              style={{
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: '8px',
                fontSize: '18px'
              }}
            >
              Booking cancelled
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push('/')}
            >
              Browse Turfs
            </button>
          </div>
        )}

        {/* Confirmed */}
        {booking.status === 'CONFIRMED' && (
          <div
            className="nvidia-card"
            style={{ padding: '32px', textAlign: 'center' }}
          >
            <p
              style={{
                fontWeight: 700,
                color: 'var(--green)',
                marginBottom: '8px',
                fontSize: '18px'
              }}
            >
              Booking Confirmed
            </p>
            <p style={{ fontSize: '15px', color: 'var(--mute)' }}>
              Your slot is confirmed. For refunds, email support@mangalmv.live with your booking ID:{' '}
              <span style={{ fontFamily: 'monospace' }}>{booking.id}</span>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
