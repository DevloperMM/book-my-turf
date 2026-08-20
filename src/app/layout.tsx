import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import React from 'react'
import './globals.css'
import Navbar from '@/components/Navbar'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'BookMySlot',
  description: 'Real-time turf booking. No double-bookings, ever.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} min-h-full flex flex-col`}
        style={{
          backgroundColor: 'var(--canvas)',
          color: 'var(--ink)'
        }}
      >
        <ClerkProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Toaster />
        </ClerkProvider>
      </body>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
    </html>
  )
}
