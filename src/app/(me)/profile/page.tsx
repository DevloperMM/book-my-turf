'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { getProfile } from '@/actions/user.action'

interface Profile {
  id: string
  email: string
  name: string | null
  createdAt: Date
  bookings: Array<{
    id: string
    status: string
    createdAt: Date
    turf: { name: string }
  }>
}

export default function ProfilePage() {
  const { isSignedIn, user } = useUser()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      router.push('/login')
      return
    }

    getProfile()
      .then((data) => {
        setProfile(data as unknown as Profile)
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
          className="max-w-2xl mx-auto px-6"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <p style={{ color: 'var(--mute)' }}>Loading...</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
        <div
          className="max-w-2xl mx-auto px-6"
          style={{ paddingTop: '64px', paddingBottom: '64px' }}
        >
          <p style={{ color: 'var(--mute)' }}>Profile not found</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-2xl mx-auto px-6"
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
          PROFILE
        </h1>

        {/* Profile card */}
        <div
          className="nvidia-card"
          style={{ padding: '32px', marginBottom: '32px' }}
        >
          <h2
            style={{ fontWeight: 700, fontSize: '22px', color: 'var(--ink)', marginBottom: '16px' }}
          >
            {profile.name || 'User'}
          </h2>
          <div style={{ fontSize: '15px' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--mute)' }}>Email: </span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{profile.email}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--mute)' }}>Member since: </span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--mute)' }}>Total bookings: </span>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                {profile.bookings.length}
              </span>
            </div>
          </div>
        </div>

        {/* Recent bookings */}
        <h2
          style={{
            fontWeight: 700,
            fontSize: '22px',
            color: 'var(--ink)',
            marginBottom: '16px'
          }}
        >
          RECENT BOOKINGS
        </h2>
        {profile.bookings.length === 0 ? (
          <p style={{ color: 'var(--mute)' }}>No bookings yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {profile.bookings.map((booking) => (
              <div
                key={booking.id}
                className="nvidia-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '16px' }}>
                    {booking.turf.name}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--mute)' }}>
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </p>
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
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
