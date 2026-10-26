import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { demoMode } from '../lib/backend'
import { useJournal } from '../state/journal'
import { PausedHint } from '../pages/UnavailablePage'
import { SyncIndicator } from './SyncIndicator'
import { useSustained } from '../lib/useSustained'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `uppercase tracking-[0.06em] ${isActive ? 'text-ribbon underline underline-offset-[6px] decoration-1' : 'hover:text-ribbon'}`

export function Layout({ children }: { children: ReactNode }) {
  const { status } = useJournal()
  const serverDown = useSustained(status.unavailable && navigator.onLine, 15_000)
  return (
    <div className="mx-auto max-w-2xl px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-32 sm:px-6">
      <nav className="no-print mb-3 flex items-center justify-between gap-4 px-1">
        <NavLink to="/" end className={navClass}>
          Today
        </NavLink>
        <div className="flex gap-4">
          <NavLink to="/days" className={navClass}>
            Days
          </NavLink>
          <NavLink to="/notes" className={navClass}>
            Notes
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            Settings
          </NavLink>
        </div>
      </nav>
      {demoMode && (
        <p className="no-print mb-3 px-1 text-ink-soft">
          Demo mode: no Supabase configured, so your (encrypted) journal is kept in this browser only.
        </p>
      )}
      {/* Only after a sustained outage, so a brief blip never shifts the page. */}
      {serverDown && (
        <div className="no-print mb-3 rounded-sm border border-ribbon/40 px-4 pt-3 pb-1">
          <PausedHint />
          <p className="mb-3">Your writing is saved on this device and will upload when it’s back.</p>
        </div>
      )}
      <SyncIndicator />
      {children}
    </div>
  )
}

// A punched sheet of typing paper. Content sits right of the margin rule.
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <article className="sheet binder min-h-[70dvh] py-8 pr-5 pl-[3.75rem] sm:py-12 sm:pr-12 sm:pl-20">
      <span aria-hidden className="punch-hole top-24" />
      <span aria-hidden className="punch-hole top-1/2" />
      <span aria-hidden className="punch-hole bottom-24" />
      {children}
    </article>
  )
}

// A small slip of the same paper, for lists (days, notes, search results).
export function Slip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <li className={`sheet slip mb-4 list-none px-5 py-4 ${className}`}>{children}</li>
}

// A page title typed straight onto the desk, above the slips.
export function DeskHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2 mb-5 px-1">
      <span className="typed-heading">{children}</span>
    </h1>
  )
}
