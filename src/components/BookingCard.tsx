import Link from 'next/link'
import { MapPin, Calendar, Clock } from 'lucide-react'
import { BookingStatusBadge } from '@/components/BookingBadge'
import type { Booking } from '@/types'

export function BookingCard({ booking }: { booking: Booking }) {
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  const fmt = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="glass-panel overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md transition-all hover:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {booking.turf ? (
              <Link
                href={`/turfs/${booking.turf.id}`}
                className="font-display text-base font-bold text-slate-100 hover:text-emerald-400 transition-colors"
              >
                {booking.turf.name}
              </Link>
            ) : (
              <span className="font-display text-base font-semibold text-slate-200">
                Turf Details Unavailable
              </span>
            )}
          </div>

          {booking.turf?.location && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="size-3.5 text-emerald-400 shrink-0" />
              <span>{booking.turf.location}</span>
            </p>
          )}

          <div className="flex items-center gap-3 pt-1 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5 text-slate-400" />
              {new Date(booking.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-slate-400" />
              {fmt(start)} – {fmt(end)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          <BookingStatusBadge status={booking.status} />
        </div>
      </div>
    </div>
  )
}
