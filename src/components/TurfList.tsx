'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTurf } from '@/actions/turf.action'
import { toast } from 'sonner'
import { TurfFormDialog } from './TurfFormDialog'
import { formatISTHourRange } from '@/lib/timezone'

interface Turf {
  id: string
  name: string
  location: string
  pricePerHr: number
  openHour: number
  closeHour: number
  slotMinutes: number
  imageUrl: string | null
}

interface TurfListProps {
  turfs: Turf[]
}

export function TurfList({ turfs }: TurfListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingTurf, setEditingTurf] = useState<Turf | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleDelete = (turfId: string, turfName: string) => {
    if (!confirm(`Delete "${turfName}"? This cannot be undone.`)) return

    startTransition(async () => {
      try {
        await deleteTurf(turfId)
        toast.success('Turf deleted')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  const handleEdit = (turf: Turf) => {
    setEditingTurf(turf)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingTurf(null)
    setDialogOpen(true)
  }

  return (
    <>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '24px' }}
      >
        <div />
        <button
          className="btn-primary"
          onClick={handleCreate}
        >
          Add Turf
        </button>
      </div>

      <div
        className="nvidia-card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
              {['Name', 'Location', 'Price/hr', 'Hours', 'Slot', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    color: 'var(--mute)',
                    borderBottom: '1px solid var(--hairline)'
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turfs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', padding: '32px', color: 'var(--mute)' }}
                >
                  No turfs found
                </td>
              </tr>
            ) : (
              turfs.map((turf) => (
                <tr
                  key={turf.id}
                  style={{ borderBottom: '1px solid var(--hairline)' }}
                >
                  <td style={{ padding: '16px', fontWeight: 700, fontSize: '16px' }}>
                    {turf.name}
                  </td>
                  <td style={{ padding: '16px', fontSize: '15px', color: 'var(--body-text)' }}>
                    {turf.location}
                  </td>
                  <td style={{ padding: '16px', fontSize: '15px', fontWeight: 700 }}>
                    ₹{turf.pricePerHr}
                  </td>
                  <td style={{ padding: '16px', fontSize: '15px', color: 'var(--body-text)' }}>
                    {formatISTHourRange(turf.openHour, turf.closeHour)}
                  </td>
                  <td style={{ padding: '16px', fontSize: '15px', color: 'var(--body-text)' }}>
                    {turf.slotMinutes}m
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn-outline"
                        style={{ height: '32px', fontSize: '14px', padding: '0 12px' }}
                        onClick={() => handleEdit(turf)}
                        disabled={isPending}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-primary"
                        style={{
                          height: '32px',
                          fontSize: '14px',
                          padding: '0 12px',
                          backgroundColor: 'var(--destructive)'
                        }}
                        onClick={() => handleDelete(turf.id, turf.name)}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TurfFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        turf={editingTurf}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
