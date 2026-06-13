'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import { Users, Settings, Activity, Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/admin', label: 'Admin', icon: Settings },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-500" aria-hidden />}
            <Icon size={18} strokeWidth={2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <Link href="/patients" className="flex items-center gap-2 font-semibold text-slate-800">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500 text-white">
        <Activity size={16} strokeWidth={2.5} />
      </span>
      BloodLens
    </Link>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-surface border-b border-slate-200 px-4 h-14">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 text-slate-600 hover:text-slate-900"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 bg-surface px-4 py-5">
        <div className="px-2 mb-6">
          <Brand />
        </div>
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-slate-200 px-4 py-5 flex flex-col">
            <div className="flex items-center justify-between px-2 mb-6">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
