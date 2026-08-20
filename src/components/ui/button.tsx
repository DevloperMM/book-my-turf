import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-green text-ink hover:bg-green-dark',
        outline: 'bg-transparent text-ink border-2 border-green hover:bg-surface-soft',
        secondary: 'bg-surface-soft text-ink hover:bg-hairline',
        ghost: 'bg-transparent text-green hover:underline',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        link: 'text-green underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-11 gap-1.5 px-6 text-base',
        xs: 'h-6 gap-1 px-2 text-xs',
        sm: 'h-8 gap-1 px-3 text-sm',
        lg: 'h-12 gap-1.5 px-8 text-lg',
        icon: 'size-11',
        'icon-xs': 'size-6',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ borderRadius: '2px', ...props.style }}
      {...props}
    />
  )
}

export { Button, buttonVariants }
