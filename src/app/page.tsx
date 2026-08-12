import { TurfGrid } from '@/components/TurfGrid'
import { getTurfs } from '@/lib/api'
import { ShieldCheckIcon, ZapIcon, LockIcon } from 'lucide-react'

export default async function Home() {
  const turfs = await getTurfs()

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-slate-900/60 p-6 sm:p-10 md:p-12 glass-panel shadow-2xl">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 size-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 size-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-mono font-medium text-emerald-400">
            <ZapIcon className="size-3.5 fill-emerald-400" />
            <span>Real-Time SSE Double-Booking Prevention</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Find Your Pitch.{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Lock Your Slot.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Browse high-quality local turfs in real-time. Tapping an available slot holds it
            instantly with guaranteed database concurrency locking.
          </p>

          {/* Quick Specs */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                <LockIcon className="size-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Instant Hold</p>
                <p className="text-slate-400">5-min payment hold window</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
                <ZapIcon className="size-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Live SSE Feed</p>
                <p className="text-slate-400">Immediate taken alerts</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                <ShieldCheckIcon className="size-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">Zero Overcharging</p>
                <p className="text-slate-400">Idempotency guaranteed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Turf Grid Header */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Available Sports Turfs</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400">
                {turfs.length} Venues
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a venue below to explore available slots & pricing
            </p>
          </div>
        </div>

        <TurfGrid turfs={turfs} />
      </section>
    </div>
  )
}
