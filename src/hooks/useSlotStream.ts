'use client'

import { useEffect, useRef } from 'react'

interface SlotUpdate {
  turfId: string
  startTime: string
  status: 'available' | 'held' | 'booked'
}

export function useSlotStream(
  turfId: string,
  onUpdate: (update: SlotUpdate) => void,
  onReconnect?: () => void
) {
  const onUpdateRef = useRef(onUpdate)
  const onReconnectRef = useRef(onReconnect)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    onReconnectRef.current = onReconnect
  }, [onReconnect])

  useEffect(() => {
    if (!turfId) return

    let closed = false
    let eventSource: EventSource | null = null

    const connect = () => {
      if (closed) return

      eventSource = new EventSource(`/api/sse/turf/${turfId}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SlotUpdate
          onUpdateRef.current(data)
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

    const reconnectHandler = () => {
      eventSource?.close()
      if (!closed) {
        connect()
        onReconnectRef.current?.()
      }
    }

    const handleOnline = () => {
      if (!closed && navigator.onLine) {
        reconnectHandler()
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      closed = true
      eventSource?.close()
      window.removeEventListener('online', handleOnline)
    }
  }, [turfId])
}
