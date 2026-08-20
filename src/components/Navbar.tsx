'use client'

import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'

export default function Navbar() {
  const { isSignedIn, user } = useUser()
  const role = user?.publicMetadata?.role as string | undefined

  return (
    <header className="sticky top-0 z-50">
      {/* Utility bar — 32px, surface-dark */}
      {/* <div
        className="flex items-center justify-end px-6 lg:px-8"
        style={{
          backgroundColor: 'var(--surface-dark)',
          color: 'var(--on-dark)',
          height: '32px',
          fontSize: '12px',
          fontWeight: 400,
          lineHeight: '1.25',
        }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-end gap-4">
          <Link href="/" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--on-dark)' }}>
            BookMySlot
          </Link>
          {isSignedIn ? (
            <span style={{ color: 'var(--on-dark)' }} className="font-medium">Signed in</span>
          ) : (
            <Link href="/login" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--on-dark)' }}>
              Sign In
            </Link>
          )}
        </div>
      </div> */}

      {/* Primary nav — 64px, surface-dark */}
      <nav
        className="flex items-center px-6 lg:px-8"
        style={{
          backgroundColor: 'var(--surface-dark)',
          color: 'var(--on-dark)',
          height: '64px',
          fontWeight: 700,
          fontSize: '16px',
          lineHeight: '1.5'
        }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight"
            style={{ color: 'var(--on-dark)' }}
          >
            BOOKMYSLOT
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="hover:opacity-70 transition-opacity"
              style={{ color: 'var(--on-dark)', fontSize: '16px', fontWeight: 700 }}
            >
              Turfs
            </Link>
            {isSignedIn && (
              <Link
                href="/bookings"
                className="hover:opacity-70 transition-opacity"
                style={{ color: 'var(--on-dark)', fontSize: '16px', fontWeight: 700 }}
              >
                My Bookings
              </Link>
            )}
            {isSignedIn && role === 'admin' && (
              <Link
                href="/admin/turfs"
                className="hover:opacity-70 transition-opacity"
                style={{ color: 'var(--on-dark)', fontSize: '16px', fontWeight: 700 }}
              >
                Manage Turfs
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <UserButton />
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--green)',
                  color: '#000000',
                  height: '44px',
                  padding: '11px 24px',
                  borderRadius: '2px',
                  fontWeight: 700,
                  fontSize: '16px'
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
