import { listTurfs } from '@/actions/turf.action'
import { TurfCard } from '@/components/TurfCard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const turfs = await listTurfs()

  return (
    <main style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}>
      <div
        className="max-w-6xl mx-auto px-6"
        style={{ paddingTop: '64px', paddingBottom: '64px' }}
      >
        {/* Hero section — surface-dark */}
        <div
          style={{
            backgroundColor: 'var(--surface-dark)',
            color: 'var(--on-dark)',
            padding: '80px 48px',
            marginBottom: '64px',
            borderRadius: '2px',
            position: 'relative'
          }}
        >
          <div
            className="corner-square"
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
          <h1
            style={{
              fontWeight: 700,
              fontSize: '48px',
              lineHeight: 1.25,
              color: 'var(--on-dark)',
              marginBottom: '16px'
            }}
          >
            BOOK YOUR TURF
          </h1>
          <p
            style={{
              fontWeight: 400,
              fontSize: '22px',
              lineHeight: 1.75,
              color: 'var(--on-dark-mute)',
              maxWidth: '600px'
            }}
          >
            Real-time slot availability. No double-bookings, ever.
          </p>
        </div>

        {turfs.length === 0 ? (
          <p style={{ color: 'var(--mute)', textAlign: 'center', padding: '48px 0' }}>
            No turfs available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {turfs.map((turf) => (
              <TurfCard
                key={turf.id}
                id={turf.id}
                name={turf.name}
                location={turf.location}
                pricePerHr={turf.pricePerHr}
                openHour={turf.openHour}
                closeHour={turf.closeHour}
                imageUrl={turf.imageUrl}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
