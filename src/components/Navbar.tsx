import { currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { Button, buttonVariants } from './ui/button'
import { HomeIcon, TicketIcon, ZapIcon } from 'lucide-react'
import { SignInButton, UserButton } from '@clerk/nextjs'

async function Navbar() {
  const user = await currentUser()

  return (
    <nav className="sticky top-0 w-full border-b border-border/40 glass-panel z-50 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
            >
              <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
                <ZapIcon className="size-5 fill-slate-950 stroke-slate-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                  BOOK MY SLOT
                </span>
                <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 -mt-1 uppercase">
                  Realtime Turfs
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <Link
              href="/"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'gap-2 hover:bg-slate-800/60 text-slate-200'
              })}
            >
              <HomeIcon className="w-4 h-4 text-emerald-400" />
              <span>Browse Turfs</span>
            </Link>

            {user ? (
              <>
                <Link
                  href="/bookings"
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'gap-2 hover:bg-slate-800/60 text-slate-200'
                  })}
                >
                  <TicketIcon className="w-4 h-4 text-emerald-400" />
                  <span>My Bookings</span>
                </Link>
                <div className="pl-1 border-l border-slate-700/60">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: 'size-8 ring-2 ring-emerald-500/30'
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <SignInButton mode="modal">
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md shadow-emerald-500/25"
                >
                  Sign In
                </Button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
