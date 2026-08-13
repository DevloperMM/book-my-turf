import { currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { buttonVariants } from './ui/button'
import { TicketIcon, UserIcon, ZapIcon } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'

async function Navbar() {
  const user = await currentUser()

  return (
    <nav className="sticky top-0 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
            >
              <div className="size-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
                <ZapIcon className="size-5 fill-white stroke-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  BOOK MY SLOT
                </span>
                <span className="text-[10px] font-mono tracking-widest text-emerald-600 -mt-1 uppercase">
                  Realtime Turfs
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {user ? (
              <>
                <Link
                  href="/me/bookings"
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'gap-2 hover:bg-slate-100 text-slate-700'
                  })}
                >
                  <TicketIcon className="w-4 h-4 text-emerald-600" />
                  <span>My Bookings</span>
                </Link>
                <Link
                  href="/me"
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'gap-2 hover:bg-slate-100 text-slate-700'
                  })}
                >
                  <UserIcon className="w-4 h-4 text-emerald-600" />
                  <span>Profile</span>
                </Link>
                <div className="pl-1 border-l border-slate-200">
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
              <Link
                href="/login"
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'gap-2 hover:bg-slate-100 text-slate-700'
                })}
              >
                <span>Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
