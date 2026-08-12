'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/skeleton'
import { getTurfSlots, holdSlot } from '@/lib/api'
import type { Slot } from '@/types'
import { Calendar, Radio, Loader2, Info } from 'lucide-react'

function nextSevenDays(): { iso: string; label: string; fullDate: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      fullDate: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }
  })
}

export function SlotPicker({ turfId }: { turfId: string }) {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const days = nextSevenDays()

  const [date, setDate] = useState(days[0].iso)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let ignore = false

    const fetchSlots = () => {
      getTurfSlots(turfId, date)
        .then((data) => {
          if (!ignore) {
            setSlots(data)
          }
        })
        .catch(() => {
          if (!ignore) {
            toast.error('Could not load slots for that day')
          }
        })
    }

    fetchSlots()

    // Establish real-time SSE stream connection
    const eventSource = new EventSource(`/api/slots/${turfId}/stream`)

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type) {
          fetchSlots()
        }
      } catch {
        // Silent catch for ping comments
      }
    }

    return () => {
      ignore = true
      eventSource.close()
    }
  }, [turfId, date])

  function handleDateChange(newDate: string) {
    setDate(newDate)
    setSlots(null)
    setSelected(null)
  }

  function handleHold(slot: Slot) {
    if (!isSignedIn) {
      toast.info('Sign in to hold a slot')
      return
    }
    setSelected(slot)
    startTransition(async () => {
      try {
        await holdSlot({
          turfId,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          idempotencyKey: `${turfId}:${slot.startTime}`
        })
        toast.success('Slot held — complete payment within the hold window')
        router.push('/bookings')
      } catch {
        toast.error('That slot was just taken — pick another')
        setSlots(
          (prev) =>
            prev?.map((s) => (s.startTime === slot.startTime ? { ...s, status: 'BOOKED' } : s)) ??
            null
        )
        setSelected(null)
      }
    })
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 glass-panel">
      {/* Realtime stream badge & legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-emerald-400" />
          <h3 className="font-semibold text-slate-200 text-sm">Select Date & Slot</h3>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-mono text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
          </span>
          <Radio className="size-3 text-emerald-400" />
          <span>Live SSE Sync</span>
        </div>
      </div>

      {/* Date selector tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {days.map((d) => {
          const isActive = d.iso === date
          return (
            <button
              key={d.iso}
              onClick={() => handleDateChange(d.iso)}
              className={cn(
                'flex shrink-0 flex-col items-center justify-center rounded-xl border px-4 py-2.5 transition-all text-xs font-mono',
                isActive
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-md shadow-emerald-500/10 font-bold'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              <span>{d.label}</span>
            </button>
          )
        })}
      </div>

      {/* Status Legends */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/30" />
          <span>Held / Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-slate-700" />
          <span>Booked</span>
        </div>
      </div>

      {/* Slot Grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 pt-2">
        {slots === null &&
          Array.from({ length: 10 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-12 rounded-xl bg-slate-800/60"
            />
          ))}

        {slots?.map((slot) => {
          const time = new Date(slot.startTime).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit'
          })
          const isAvailable = slot.status === 'AVAILABLE'
          const isHeld = slot.status === 'HELD'
          const isSelected = selected?.startTime === slot.startTime

          return (
            <button
              key={slot.startTime}
              disabled={!isAvailable || isPending}
              onClick={() => handleHold(slot)}
              className={cn(
                'relative flex items-center justify-center rounded-xl border py-3 font-mono text-xs sm:text-sm font-semibold tabular-nums transition-all duration-200',
                !isAvailable &&
                  !isHeld &&
                  'cursor-not-allowed border-slate-800/60 bg-slate-950/40 text-slate-600 opacity-60 line-through',
                isHeld &&
                  'cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-400/80',
                isAvailable &&
                  !isSelected &&
                  'border-emerald-500/40 bg-slate-950/80 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/20 hover:scale-[1.02] shadow-sm',
                isSelected &&
                  'border-emerald-400 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]'
              )}
            >
              {isSelected && isPending ? (
                <Loader2 className="size-4 animate-spin text-slate-950" />
              ) : (
                time
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
        <Info className="size-4 text-emerald-400 shrink-0 mt-0.5" />
        <p>
          Selecting an open slot instantly holds it for you for 5 minutes. Complete payment on your
          Bookings page to lock your time slot.
        </p>
      </div>
    </div>
  )
}
