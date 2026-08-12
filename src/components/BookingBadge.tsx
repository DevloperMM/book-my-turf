import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { BookingStatus } from '@/types'

const STYLES: Record<BookingStatus, string> = {
  HELD: 'border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold shadow-sm shadow-amber-500/10',
  PAID: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400 font-semibold',
  CONFIRMED:
    'border-emerald-500/40 bg-emerald-500/20 text-emerald-400 font-bold shadow-sm shadow-emerald-500/15',
  EXPIRED: 'border-slate-800 bg-slate-950/60 text-slate-500',
  CANCELLED: 'border-rose-500/30 bg-rose-500/10 text-rose-400'
}

const LABELS: Record<BookingStatus, string> = {
  HELD: 'Held (Pay Now)',
  PAID: 'Payment Processing',
  CONFIRMED: 'Confirmed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-mono text-xs px-2.5 py-0.5 rounded-full', STYLES[status])}
    >
      {LABELS[status]}
    </Badge>
  )
}
