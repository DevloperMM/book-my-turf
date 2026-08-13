import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, JetBrains_Mono } from 'next/font/google'
import React from 'react'
import './globals.css'
import { Toaster } from '@/components/ui/toast'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'BOOK MY SLOT',
  description: 'Book Your Slots Easily'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans`}
      >
        <ClerkProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            {children}
          </main>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  )
}
