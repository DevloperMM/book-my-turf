'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface BookingUpdate {
  status?: string
  paymentStatus?: string
}

// eslint-disable-next-line no-unused-vars
export function useBookingStream(bookingId: string, onUpdate: (update: BookingUpdate) => void) {
  const onUpdateRef = useRef(onUpdate)
  const router = useRouter()

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!bookingId) return

    let closed = false
    let eventSource: EventSource | null = null

    const connect = () => {
      if (closed) return

      eventSource = new EventSource(`/api/sse/booking/${bookingId}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.error === 'unauthorized') {
            router.push('/login')
            return
          }
          onUpdateRef.current(data as BookingUpdate)
        } catch {
          // ignore parse errors
        }
      }

      eventSource.onerror = () => {
        eventSource?.close()
        if (!closed) {
          setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      eventSource?.close()
    }
  }, [bookingId, router])
}
