import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { BookingCard } from '@/components/BookingCard'
import type { Booking } from '@/types/index'
import { Ticket, ArrowRight } from 'lucide-react'

export function BookingList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center glass-panel">
        <div className="mx-auto size-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Ticket className="size-6 text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No active bookings yet</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Explore local sports turfs and pick your preferred time slot to start playing.
        </p>
        <Link
          href="/"
          className={buttonVariants({
            size: 'sm',
            className:
              'mt-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold gap-2 shadow-md shadow-emerald-500/20'
          })}
        >
          <span>Explore Available Turfs</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
        />
      ))}
    </div>
  )
}
