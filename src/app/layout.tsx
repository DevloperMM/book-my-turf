import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, Oswald, JetBrains_Mono } from 'next/font/google'
import React from 'react'
import './globals.css'
import { Toaster } from '@/components/ui/toast'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

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
      className={`dark ${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground bg-radial-gradient">
        <ClerkProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            {children}
          </main>
          <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="font-semibold text-foreground/80">Book My Slot</span>
              <span>Real-time pitch reservation with instant double-booking prevention</span>
            </div>
          </footer>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  )
}
