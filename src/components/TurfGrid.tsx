'use client'

import { TurfCard } from '@/components/TurfCard'
import type { Turf } from '@/types/index'
import { CalendarX2 } from 'lucide-react'

export function TurfGrid({ turfs }: { turfs: Turf[] }) {
  if (turfs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center glass-panel">
        <div className="mx-auto size-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <CalendarX2 className="size-6 text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No sports turfs listed yet</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          We are in the process of adding premium sports venues. Check back shortly!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {turfs.map((turf) => (
        <TurfCard
          key={turf.id}
          turf={turf}
        />
      ))}
    </div>
  )
}
