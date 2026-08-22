'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useTransition } from 'react'
import { turfSchema } from '@/lib/schemas'
import { createTurf, updateTurf } from '@/actions/turf.action'
import { toast } from 'sonner'

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

interface TurfFormDialogProps {
  open: boolean
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void
  turf?: Turf | null
  onSuccess?: () => void
}

export function TurfFormDialog({ open, onOpenChange, turf, onSuccess }: TurfFormDialogProps) {
  const [isPending, startTransition] = useTransition()
  const isEditing = !!turf

  const form = useForm({
    resolver: zodResolver(turfSchema),
    defaultValues: {
      name: turf?.name ?? '',
      location: turf?.location ?? '',
      pricePerHr: turf?.pricePerHr ?? 0,
      openHour: turf?.openHour ?? 6,
      closeHour: turf?.closeHour ?? 22,
      slotMinutes: turf?.slotMinutes ?? 60,
      imageUrl: turf?.imageUrl ?? ''
    }
  })

  useEffect(() => {
    if (open) {
      if (turf) {
        form.reset({
          name: turf.name,
          location: turf.location,
          pricePerHr: turf.pricePerHr,
          openHour: turf.openHour,
          closeHour: turf.closeHour,
          slotMinutes: turf.slotMinutes,
          imageUrl: turf.imageUrl ?? ''
        })
      } else {
        form.reset({
          name: '',
          location: '',
          pricePerHr: 0,
          openHour: 6,
          closeHour: 22,
          slotMinutes: 60,
          imageUrl: ''
        })
      }
    }
  }, [open, turf, form])

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      try {
        if (isEditing) {
          await updateTurf(turf!.id, data)
          toast.success('Turf updated successfully')
        } else {
          const formData = new FormData()
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              formData.append(key, String(value))
            }
          })
          await createTurf(formData)
          toast.success('Turf created successfully')
        }
        form.reset()
        onOpenChange(false)
        onSuccess?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  })

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div
        className="nvidia-card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          padding: '32px',
          zIndex: 10,
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <h2
          style={{
            fontWeight: 700,
            fontSize: '24px',
            lineHeight: 1.25,
            color: 'var(--ink)',
            marginBottom: '24px'
          }}
        >
          {isEditing ? 'EDIT TURF' : 'CREATE TURF'}
        </h2>

        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                color: 'var(--mute)',
                marginBottom: '4px'
              }}
            >
              Name
            </label>
            <input
              {...form.register('name')}
              placeholder="Turf name"
              style={{
                width: '100%',
                height: '44px',
                padding: '12px 16px',
                borderRadius: '2px',
                border: '1px solid var(--hairline)',
                backgroundColor: 'var(--canvas)',
                color: 'var(--ink)',
                fontSize: '16px',
                outline: 'none'
              }}
            />
            {form.formState.errors.name && (
              <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                color: 'var(--mute)',
                marginBottom: '4px'
              }}
            >
              Location
            </label>
            <input
              {...form.register('location')}
              placeholder="Address"
              style={{
                width: '100%',
                height: '44px',
                padding: '12px 16px',
                borderRadius: '2px',
                border: '1px solid var(--hairline)',
                backgroundColor: 'var(--canvas)',
                color: 'var(--ink)',
                fontSize: '16px',
                outline: 'none'
              }}
            />
            {form.formState.errors.location && (
              <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                {form.formState.errors.location.message}
              </p>
            )}
          </div>

          {/* Price */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                color: 'var(--mute)',
                marginBottom: '4px'
              }}
            >
              Price per Hour (₹)
            </label>
            <input
              type="number"
              {...form.register('pricePerHr', { valueAsNumber: true })}
              placeholder="500"
              style={{
                width: '100%',
                height: '44px',
                padding: '12px 16px',
                borderRadius: '2px',
                border: '1px solid var(--hairline)',
                backgroundColor: 'var(--canvas)',
                color: 'var(--ink)',
                fontSize: '16px',
                outline: 'none'
              }}
            />
            {form.formState.errors.pricePerHr && (
              <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                {form.formState.errors.pricePerHr.message}
              </p>
            )}
          </div>

          {/* Hours & Slot */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: 'var(--mute)',
                  marginBottom: '4px'
                }}
              >
                Open Hour (IST)
              </label>
              <input
                type="number"
                {...form.register('openHour', { valueAsNumber: true })}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '12px 16px',
                  borderRadius: '2px',
                  border: '1px solid var(--hairline)',
                  backgroundColor: 'var(--canvas)',
                  color: 'var(--ink)',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
              {form.formState.errors.openHour && (
                <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                  {form.formState.errors.openHour.message}
                </p>
              )}
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: 'var(--mute)',
                  marginBottom: '4px'
                }}
              >
                Close Hour (IST)
              </label>
              <input
                type="number"
                {...form.register('closeHour', { valueAsNumber: true })}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '12px 16px',
                  borderRadius: '2px',
                  border: '1px solid var(--hairline)',
                  backgroundColor: 'var(--canvas)',
                  color: 'var(--ink)',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
              {form.formState.errors.closeHour && (
                <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                  {form.formState.errors.closeHour.message}
                </p>
              )}
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: 'var(--mute)',
                  marginBottom: '4px'
                }}
              >
                Slot (min)
              </label>
              <input
                type="number"
                {...form.register('slotMinutes', { valueAsNumber: true })}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '12px 16px',
                  borderRadius: '2px',
                  border: '1px solid var(--hairline)',
                  backgroundColor: 'var(--canvas)',
                  color: 'var(--ink)',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
              {form.formState.errors.slotMinutes && (
                <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                  {form.formState.errors.slotMinutes.message}
                </p>
              )}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                color: 'var(--mute)',
                marginBottom: '4px'
              }}
            >
              Image URL (optional)
            </label>
            <input
              {...form.register('imageUrl')}
              placeholder="https://..."
              style={{
                width: '100%',
                height: '44px',
                padding: '12px 16px',
                borderRadius: '2px',
                border: '1px solid var(--hairline)',
                backgroundColor: 'var(--canvas)',
                color: 'var(--ink)',
                fontSize: '16px',
                outline: 'none'
              }}
            />
            {form.formState.errors.imageUrl && (
              <p style={{ fontSize: '14px', color: 'var(--destructive)', marginTop: '4px' }}>
                {form.formState.errors.imageUrl.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div
            className="flex gap-3 justify-end"
            style={{ marginTop: '16px' }}
          >
            <button
              type="button"
              className="btn-outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
