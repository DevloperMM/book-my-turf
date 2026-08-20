import { listTurfs } from '@/actions/turf.action'
import { TurfList } from '@/components/TurfList'

export const dynamic = 'force-dynamic'

export default async function AdminTurfsPage() {
  const turfs = await listTurfs()

  const serializedTurfs = turfs.map((turf) => ({
    ...turf,
    pricePerHr: turf.pricePerHr,
    openHour: turf.openHour,
    closeHour: turf.closeHour,
    slotMinutes: turf.slotMinutes
  }))

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-6xl mx-auto px-6"
        style={{ paddingTop: '64px', paddingBottom: '64px' }}
      >
        <h1
          style={{
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: 1.25,
            color: 'var(--ink)',
            marginBottom: '32px'
          }}
        >
          MANAGE TURFS
        </h1>
        <TurfList turfs={serializedTurfs} />
      </div>
    </main>
  )
}
