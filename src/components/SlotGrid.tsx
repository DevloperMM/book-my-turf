'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { createHold } from '@/actions/booking.action'
import { useSlotStream } from '@/hooks/useSlotStream'
import { toast } from 'sonner'
import { getISTHourFromUTC, formatISTHour } from '@/lib/timezone'

interface Slot {
  startTime: string
  endTime: string
  status: 'available' | 'held' | 'booked'
}

interface SlotGridProps {
  turfId: string
  initialSlots: Slot[]
}

export function SlotGrid({ turfId, initialSlots }: SlotGridProps) {
  const router = useRouter()
  const { isSignedIn } = useUser()
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [isPending, startTransition] = useTransition()
  const didReconnect = useRef(false)

  useSlotStream(
    turfId,
    (update) => {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.startTime === update.startTime ? { ...slot, status: update.status } : slot
        )
      )
    },
    () => {
      didReconnect.current = true
      router.refresh()
    }
  )

  useEffect(() => {
    if (didReconnect.current) {
      didReconnect.current = false
      setSlots(initialSlots)
    }
  }, [initialSlots])

  const handleBook = (startTime: string) => {
    if (!isSignedIn) {
      toast.error('Please sign in to book this slot')
      router.push('/login')
      return
    }

    startTransition(async () => {
      setSlots((prev) =>
        prev.map((slot) => (slot.startTime === startTime ? { ...slot, status: 'held' } : slot))
      )

      const result = await createHold({ turfId, startTime })

      if (result.ok) {
        toast.success('Slot held! Complete payment within 5 minutes.')
        router.push(`/booking/${result.bookingId}`)
      } else {
        setSlots((prev) =>
          prev.map((slot) =>
            slot.startTime === startTime ? { ...slot, status: 'available' } : slot
          )
        )
        toast.error(result.reason === 'SLOT_TAKEN' ? 'This slot was just taken' : 'Failed to book')
      }
    })
  }

  return (
    <div
      className="nvidia-card"
      style={{ padding: '24px' }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {slots.map((slot) => {
          const start = new Date(slot.startTime)
          const end = new Date(slot.endTime)
          const istHour = getISTHourFromUTC(start)
          const istEndHour = getISTHourFromUTC(end)
          const label = `${formatISTHour(istHour)} — ${formatISTHour(istEndHour)}`
          const now = new Date()
          const isPast = end <= now

          return (
            <div
              key={slot.startTime}
              style={{
                border: '1px solid var(--hairline)',
                borderRadius: '2px',
                padding: '12px',
                textAlign: 'center'
              }}
            >
              <p
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  lineHeight: 1.4,
                  color: 'var(--ink)',
                  marginBottom: '8px'
                }}
              >
                {label}
              </p>

              {slot.status === 'booked' ? (
                <div
                  className="badge-tag w-full justify-center"
                  style={{ display: 'flex' }}
                >
                  Booked
                </div>
              ) : slot.status === 'held' ? (
                <div
                  className="badge-tag w-full justify-center"
                  style={{
                    display: 'flex',
                    border: '1px solid var(--green)',
                    background: 'transparent',
                    color: 'var(--green)'
                  }}
                >
                  Held
                </div>
              ) : isPast ? (
                <div
                  className="badge-tag w-full justify-center"
                  style={{ display: 'flex', opacity: 0.5 }}
                >
                  Past
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: '100%', height: '36px', fontSize: '14.4px', padding: '0 12px' }}
                  onClick={() => handleBook(slot.startTime)}
                  disabled={isPending}
                >
                  {isPending ? '...' : 'Book'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
