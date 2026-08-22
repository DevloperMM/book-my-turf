'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { listBookings } from '@/actions/booking.action'
import { toISTDateString, toISTTimeRange } from '@/lib/timezone'

interface Booking {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  status: string
  holdExpiresAt: Date
  createdAt: Date
  turf: { name: string; location: string; pricePerHr: number }
  payment: { amount: number; status: string } | null
}

const statusStyles: Record<string, { bg: string; color: string }> = {
  HELD: { bg: 'transparent', color: 'var(--green)' },
  PAID: { bg: 'var(--surface-soft)', color: 'var(--ink)' },
  CONFIRMED: { bg: 'var(--green)', color: '#000000' },
  EXPIRED: { bg: 'var(--destructive)', color: '#ffffff' },
  CANCELLED: { bg: 'var(--destructive)', color: '#ffffff' }
}

export default function BookingsPage() {
  const { isSignedIn, user } = useUser()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      router.push('/login')
      return
    }

    listBookings(user.id)
      .then((data) => {
        setBookings(data as unknown as Booking[])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [isSignedIn, user?.id, router])

  if (loading) {
    return (
      <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
        <div
          className="max-w-6xl mx-auto px-6"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <p style={{ color: 'var(--mute)' }}>Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-6xl mx-auto px-6"
        style={{ paddingTop: '64px', paddingBottom: '64px' }}
      >
        <h1
          style={{
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: 1.25,
            color: 'var(--ink)',
            marginBottom: '32px'
          }}
        >
          MY BOOKINGS
        </h1>

        {bookings.length === 0 ? (
          <p style={{ color: 'var(--mute)', textAlign: 'center', padding: '48px 0' }}>
            <span>No bookings yet</span>
            <br />
            <Link
              href="/"
              style={{ color: 'var(--green)', fontWeight: 700 }}
            >
              Browse turfs
            </Link>
          </p>
        ) : (
          <div
            className="nvidia-card"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                  {['Turf', 'Date', 'Time', 'Status', 'Amount'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        color: 'var(--mute)',
                        borderBottom: '1px solid var(--hairline)'
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const date = new Date(booking.date)
                  const start = new Date(booking.startTime)
                  const end = new Date(booking.endTime)
                  const dateIST = toISTDateString(date)
                  const timeRangeIST = toISTTimeRange(start, end)
                  const style = statusStyles[booking.status] || {
                    bg: 'var(--surface-soft)',
                    color: 'var(--ink)'
                  }

                  return (
                    <tr
                      key={booking.id}
                      onClick={() => router.push(`/booking/${booking.id}`)}
                      style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '16px', fontWeight: 700, fontSize: '16px' }}>
                        {booking.turf.name}
                      </td>
                      <td style={{ padding: '16px', fontSize: '15px', color: 'var(--body-text)' }}>
                        {dateIST}
                      </td>
                      <td style={{ padding: '16px', fontSize: '15px', color: 'var(--body-text)' }}>
                        {timeRangeIST}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '2px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: style.bg,
                            color: style.color
                          }}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '15px', fontWeight: 700 }}>
                        ₹{booking.turf.pricePerHr}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
