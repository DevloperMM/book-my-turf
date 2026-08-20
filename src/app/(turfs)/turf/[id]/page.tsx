import { notFound } from 'next/navigation'
import { getTurfById, getTurfSlots } from '@/actions/turf.action'
import { SlotGrid } from '@/components/SlotGrid'
import Image from 'next/image'
import { getCurrentISTDate, formatISTHourRange, toISTDateString } from '@/lib/timezone'

export default async function TurfDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let turf
  try {
    turf = await getTurfById(id)
  } catch {
    notFound()
  }

  const today = getCurrentISTDate()
  const slots = await getTurfSlots(id, today)

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-7xl mx-auto px-6"
        style={{ paddingTop: '64px', paddingBottom: '64px' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column — Turf Details (2/5 width) */}
          <div className="lg:col-span-2">
            <div
              className="nvidia-card"
              style={{ padding: '32px', position: 'sticky', top: '80px' }}
            >
              <div style={{ marginBottom: '24px' }}>
                <h1
                  style={{
                    fontWeight: 700,
                    fontSize: '28px',
                    lineHeight: 1.25,
                    color: 'var(--ink)',
                    marginBottom: '6px'
                  }}
                >
                  {turf.name}
                </h1>
                <p style={{ color: 'var(--mute)', fontSize: '15px' }}>{turf.location}</p>
              </div>

              {turf.imageUrl && (
                <div style={{ marginBottom: '24px', borderRadius: '2px', overflow: 'hidden' }}>
                  <Image
                    src={turf.imageUrl}
                    alt={turf.name}
                    className="w-full object-cover"
                    style={{ aspectRatio: '16/10' }}
                    width={1172}
                    height={780}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--hairline)'
                  }}
                >
                  <span
                    style={{
                      color: 'var(--mute)',
                      fontSize: '14px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  >
                    Price
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '20px', color: 'var(--ink)' }}>
                    ₹{turf.pricePerHr}
                    <span style={{ fontSize: '14px', color: 'var(--mute)', fontWeight: 400 }}>
                      /hr
                    </span>
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--hairline)'
                  }}
                >
                  <span
                    style={{
                      color: 'var(--mute)',
                      fontSize: '14px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  >
                    Hours
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>
                    {formatISTHourRange(turf.openHour, turf.closeHour)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span
                    style={{
                      color: 'var(--mute)',
                      fontSize: '14px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  >
                    Slot Duration
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>
                    {turf.slotMinutes} min
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Slot Grid (3/5 width) */}
          <div className="lg:col-span-3">
            <div style={{ marginBottom: '20px' }}>
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: '22px',
                  lineHeight: 1.25,
                  color: 'var(--ink)'
                }}
              >
                Available Slots
              </h2>
              <p style={{ color: 'var(--mute)', fontSize: '14px', marginTop: '4px' }}>
                Today — {toISTDateString(new Date())}
              </p>
            </div>
            <SlotGrid
              turfId={turf.id}
              initialSlots={slots}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
