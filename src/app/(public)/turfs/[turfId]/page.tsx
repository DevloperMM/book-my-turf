import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Clock, DollarSign, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'
import { SlotPicker } from '@/components/SlotPicker'
import { getTurfById } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function TurfDetailPage({ params }: { params: Promise<{ turfId: string }> }) {
  const { turfId } = await params
  const turf = await getTurfById(turfId).catch(() => null)
  if (!turf) notFound()

  return (
    <div className="space-y-6">
      {/* Back button link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to all turfs</span>
      </Link>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Venue Info Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 glass-panel shadow-xl">
            <div className="relative aspect-[16/10] w-full bg-slate-950">
              {turf.imageUrl ? (
                <Image
                  src={turf.imageUrl}
                  alt={turf.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                  No venue image available
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />

              <div className="absolute bottom-4 left-4 right-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/80 backdrop-blur px-3 py-0.5 text-[11px] font-mono text-emerald-400 mb-2">
                  <Sparkles className="size-3" />
                  <span>Verified Venue</span>
                </div>
                <h1 className="font-display text-2xl font-extrabold text-white leading-tight">
                  {turf.name}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                  <MapPin className="size-3.5 text-emerald-400 shrink-0" />
                  <span>{turf.location}</span>
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <DollarSign className="size-3.5 text-emerald-400" />
                    <span>Hourly Rate</span>
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-white">
                    ₹{turf.pricePerHr}
                    <span className="text-xs font-normal text-slate-400">/hr</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="size-3.5 text-cyan-400" />
                    <span>Operating Hours</span>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-white">
                    {turf.openHour}:00 - {turf.closeHour}:00
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Guaranteed Concurrency Lock</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Every booking attempt is locked at the PostgreSQL database index level. Double
                  bookings are strictly impossible.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Slot Picker */}
        <div className="lg:col-span-7">
          <SlotPicker turfId={turf.id} />
        </div>
      </div>
    </div>
  )
}
