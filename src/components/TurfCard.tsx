'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Clock, ArrowRight } from 'lucide-react'
import type { Turf } from '@/types/index'

export function TurfCard({ turf }: { turf: Turf }) {
  return (
    <Link
      href={`/turfs/${turf.id}`}
      className="group block"
    >
      <div className="glass-card overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:border-emerald-500/40 group-hover:shadow-xl group-hover:shadow-emerald-500/10">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
          {turf.imageUrl ? (
            <Image
              src={turf.imageUrl}
              alt={turf.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              No photo available
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />

          {/* Price Badge */}
          <div className="absolute top-3 right-3 rounded-full bg-slate-950/80 backdrop-blur border border-emerald-500/40 px-3 py-1 text-xs font-mono font-bold text-emerald-400 shadow-md">
            ₹{turf.pricePerHr}
            <span className="text-slate-400 text-[10px]">/hr</span>
          </div>

          {/* Slot Duration Badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 text-xs text-slate-300 font-mono bg-slate-950/70 backdrop-blur px-2.5 py-1 rounded-md border border-slate-800">
            <Clock className="size-3 text-emerald-400" />
            <span>{turf.slotMinutes} mins</span>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug">
              {turf.name}
            </h3>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="size-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{turf.location}</span>
          </p>

          <div className="pt-2 flex items-center justify-between text-xs font-medium text-emerald-400 group-hover:translate-x-0.5 transition-transform">
            <span>View Available Slots</span>
            <ArrowRight className="size-3.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
