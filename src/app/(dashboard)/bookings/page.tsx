import { auth } from '@clerk/nextjs/server'
import { BookingList } from '@/components/BookingList'
import { redirect } from 'next/navigation'
import { listMyBookings } from '@/services/booking'
import { Ticket } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MyBookingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/login')

  const rawBookings = await listMyBookings(userId)
  const bookings = rawBookings.map((b) => ({
    ...b,
    date: b.date.toISOString(),
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    holdExpiresAt: b.holdExpiresAt?.toISOString()
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Ticket className="size-6 text-emerald-400" />
            <span>My Slot Bookings</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400">
              {bookings.length} Total
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            View active holds, confirmed reservations, and past bookings
          </p>
        </div>
      </div>

      <BookingList bookings={bookings} />
    </div>
  )
}
