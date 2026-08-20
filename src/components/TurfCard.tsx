import Image from 'next/image'
import Link from 'next/link'
import { formatISTHourRange } from '@/lib/timezone'

interface TurfCardProps {
  id: string
  name: string
  location: string
  pricePerHr: number
  openHour: number
  closeHour: number
  imageUrl?: string | null
}

export function TurfCard({
  id,
  name,
  location,
  pricePerHr,
  openHour,
  closeHour,
  imageUrl
}: TurfCardProps) {
  return (
    <Link href={`/turf/${id}`}>
      <div
        className="nvidia-card h-full relative overflow-hidden"
        style={{ padding: 0 }}
      >
        {/* Corner square — signature NVIDIA motif */}
        <div className="corner-square" />

        {imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <Image
              src={imageUrl}
              alt={name}
              width={1172}
              height={780}
              priority
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div style={{ padding: '24px' }}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '17px',
                lineHeight: 1.47,
                color: 'var(--ink)'
              }}
            >
              {name}
            </h3>
            <span className="badge-tag shrink-0">₹{pricePerHr}/hr</span>
          </div>

          <p
            style={{
              fontSize: '15px',
              fontWeight: 400,
              lineHeight: 1.67,
              color: 'var(--mute)',
              marginBottom: '12px'
            }}
          >
            {location}
          </p>

          <p
            style={{
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: 1.43,
              color: 'var(--stone)',
              textTransform: 'uppercase'
            }}
          >
            {formatISTHourRange(openHour, closeHour)}
          </p>
        </div>
      </div>
    </Link>
  )
}
