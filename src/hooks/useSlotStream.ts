'use client'

import { useEffect, useRef } from 'react'

interface SlotUpdate {
  turfId: string
  startTime: string
  status: 'available' | 'held' | 'booked'
}

// eslint-disable-next-line no-unused-vars
export function useSlotStream(turfId: string, onUpdate: (update: SlotUpdate) => void) {
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    let closed = false
    const eventSource = new EventSource(`/api/sse/turf/${turfId}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SlotUpdate
        onUpdateRef.current(data)
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      if (!closed) {
        setTimeout(() => {
          if (!closed) {
            const retry = new EventSource(`/api/sse/turf/${turfId}`)
            retry.onmessage = eventSource.onmessage
            retry.onerror = () => retry.close()
          }
        }, 3000)
      }
    }

    return () => {
      closed = true
      eventSource.close()
    }
  }, [turfId])
}
